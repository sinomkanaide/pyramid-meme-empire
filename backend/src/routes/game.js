const express = require('express');
const { authenticateToken, tapRateLimit } = require('../middleware/auth');
const User = require('../models/User');
const GameProgress = require('../models/GameProgress');
const { getXpProgress, calculateLevelFromXp, applyLevelCap, FREE_USER_MAX_LEVEL } = require('../models/GameProgress');
const db = require('../config/database');

const router = express.Router();

// ===== Trade XP (gamified bridges/swaps) config =====
const TRADE_XP = {
  BASE: 25,          // flat XP per verified trade
  PER_USD: 1,        // + this much XP per $1 of trade volume
  PER_TRADE_CAP: 250,// max volume-bonus XP from a single trade
  DAILY_CAP: 500,    // max trade XP per user per day
  MIN_USD: 1,        // ignore dust trades below this volume
};

// Dedupe table so a trade can only be claimed once. Auto-created on boot.
async function initTradeXpTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS trade_xp_claims (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tx_hash VARCHAR(80) UNIQUE NOT NULL,
        volume_usd NUMERIC(18,2) DEFAULT 0,
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('[TradeXP] table init error:', err.message);
  }
}
initTradeXpTable();

// All routes require authentication
router.use(authenticateToken);

// POST /game/trade-xp - award XP for a completed bridge/swap done via the LI.FI widget.
// Trust model: we verify the trade server-side against LI.FI's /status (not the client),
// and only credit the wallet that actually executed it.
router.post('/trade-xp', async (req, res) => {
  try {
    const { txHash, fromChain, toChain } = req.body || {};
    if (!txHash || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return res.status(400).json({ error: 'Invalid txHash' });
    }
    const userId = req.user.id;
    const userWallet = (req.user.wallet_address || '').toLowerCase();
    const hash = txHash.toLowerCase();

    // 1. Anti-replay: a trade can only be claimed once.
    const existing = await db.query('SELECT id FROM trade_xp_claims WHERE tx_hash = $1', [hash]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Trade already claimed' });
    }

    // 2. Verify the trade with LI.FI /status (server-side, trustworthy).
    //    fromChain/toChain (client-provided, non-sensitive) just help LI.FI locate
    //    same-chain swaps; the trusted data (fromAddress, amountUSD) comes from LI.FI.
    let statusUrl = `https://li.quest/v1/status?txHash=${txHash}`;
    const fc = Number(fromChain);
    const tc = Number(toChain);
    if (Number.isInteger(fc)) statusUrl += `&fromChain=${fc}`;
    if (Number.isInteger(tc)) statusUrl += `&toChain=${tc}`;

    let status;
    try {
      const r = await fetch(statusUrl);
      status = await r.json();
    } catch (err) {
      console.error('[TradeXP] status fetch failed:', err.message);
      return res.status(502).json({ error: 'Could not verify trade, try again' });
    }

    if (!status || status.status !== 'DONE') {
      return res.status(400).json({ error: 'Trade not completed yet', status: status?.status || 'UNKNOWN' });
    }

    // 3. Anti-spoof: the trade must have been sent BY this user's wallet.
    const fromAddress = (status.fromAddress || '').toLowerCase();
    if (!fromAddress || fromAddress !== userWallet) {
      return res.status(403).json({ error: 'This trade was not made by your wallet' });
    }

    // 4. Volume in USD, as reported by LI.FI (not the client).
    const volumeUsd = Number(status.sending?.amountUSD || status.receiving?.amountUSD || 0);
    if (!(volumeUsd >= TRADE_XP.MIN_USD)) {
      return res.status(400).json({ error: `Trade volume below $${TRADE_XP.MIN_USD} minimum` });
    }

    // 5. XP with per-trade + daily caps.
    let xp = TRADE_XP.BASE + Math.min(Math.floor(volumeUsd * TRADE_XP.PER_USD), TRADE_XP.PER_TRADE_CAP);

    const todayRow = await db.query(
      `SELECT COALESCE(SUM(xp_awarded), 0) AS total
       FROM trade_xp_claims
       WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [userId]
    );
    const awardedToday = parseInt(todayRow.rows[0].total, 10) || 0;
    const remainingToday = Math.max(0, TRADE_XP.DAILY_CAP - awardedToday);
    xp = Math.min(xp, remainingToday);

    if (xp <= 0) {
      return res.json({ success: true, xpAwarded: 0, dailyCapReached: true, message: 'Daily trade XP cap reached' });
    }

    // 6. Reserve the claim first (UNIQUE guards races), then award.
    await db.query(
      `INSERT INTO trade_xp_claims (user_id, tx_hash, volume_usd, xp_awarded) VALUES ($1, $2, $3, $4)`,
      [userId, hash, volumeUsd, xp]
    );

    const updated = await GameProgress.addBricks(userId, xp, req.user.isPremium, req.user.hasBattlePass);

    console.log(`[TradeXP] +${xp} XP to user ${userId} | vol $${volumeUsd} | tx ${hash}`);

    return res.json({
      success: true,
      xpAwarded: xp,
      volumeUsd,
      bricks: updated.bricks,
      level: updated.level,
      leveledUp: updated.leveledUp,
      xpProgress: updated.xpProgress
    });
  } catch (error) {
    console.error('[TradeXP] error:', error.message);
    return res.status(500).json({ error: 'Failed to award trade XP' });
  }
});

// GET /game/progress - Get current game progress
router.get('/progress', async (req, res) => {
  try {
    const progress = await GameProgress.findByUserId(req.user.id);
    const rank = await GameProgress.getRank(req.user.id);

    if (!progress) {
      return res.status(404).json({ error: 'Game progress not found' });
    }

    // Auto-heal: recalculate level from bricks if out of sync
    const calculatedLevel = calculateLevelFromXp(parseInt(progress.bricks) || 0);
    const correctLevel = applyLevelCap(calculatedLevel, req.user.isPremium, req.user.hasBattlePass);
    if (correctLevel !== progress.level) {
      await db.query('UPDATE game_progress SET level = $1 WHERE user_id = $2', [correctLevel, req.user.id]);
      progress.level = correctLevel;
    }

    const isLevelCapped = !req.user.isPremium && !req.user.hasBattlePass && progress.level >= FREE_USER_MAX_LEVEL;

    // Check if boost is active
    const now = new Date();
    const boostExpiresAt = progress.boost_expires_at ? new Date(progress.boost_expires_at) : null;
    const isBoostActive = boostExpiresAt && boostExpiresAt > now;
    const activeMultiplier = isBoostActive ? parseFloat(progress.boost_multiplier) : 1;

    // Calculate XP progress for current level
    const xpProgress = getXpProgress(progress.bricks, progress.level);

    // Get Battle Pass info and referral stats
    const battlePassInfo = req.user.hasBattlePass ? await User.getBattlePassInfo(req.user.id) : null;
    const referralStats = req.user.hasBattlePass ? await User.getVerifiedReferralStats(req.user.id) : null;

    // Get quest bonus (KiiChain, all users)
    const questBonusMultiplier = await GameProgress.getQuestBonus(req.user.id);
    const questBonusExpiresAt = progress.quest_bonus_expires_at
      ? new Date(progress.quest_bonus_expires_at)
      : null;
    const questBonusActive = questBonusMultiplier > 1 && questBonusExpiresAt && questBonusExpiresAt > now;

    // Battle Pass users always have X5 boost
    const effectiveMultiplier = req.user.hasBattlePass ? 5 : activeMultiplier;
    const effectiveBoostType = req.user.hasBattlePass ? 'battle_pass' : (isBoostActive ? progress.boost_type : null);

    res.json({
      bricks: progress.bricks,
      level: progress.level,
      pmeTokens: progress.pme_tokens,
      energy: progress.energy,
      maxEnergy: progress.max_energy || 100,
      totalTaps: progress.total_taps,
      boostMultiplier: effectiveMultiplier,
      boostExpiresAt: req.user.hasBattlePass ? null : (isBoostActive ? boostExpiresAt.toISOString() : null),
      boostType: effectiveBoostType,
      isBoostActive: isBoostActive || req.user.hasBattlePass,
      rank,
      isPremium: req.user.isPremium,
      hasBattlePass: req.user.hasBattlePass,
      battlePassInfo,
      referralStats,
      isLevelCapped,
      maxFreeLevel: FREE_USER_MAX_LEVEL,
      xpProgress,
      questBonusMultiplier: questBonusActive ? questBonusMultiplier : 1,
      questBonusExpiresAt: questBonusActive ? questBonusExpiresAt.toISOString() : null
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get game progress' });
  }
});

// ========== BOT DETECTION ==========
// Track tap timestamps per user in memory (last 20 taps)
const tapTimestamps = new Map();

function detectBot(userId) {
  if (!tapTimestamps.has(userId)) {
    tapTimestamps.set(userId, []);
  }

  const timestamps = tapTimestamps.get(userId);
  const now = Date.now();
  timestamps.push(now);

  // Keep only last 20
  if (timestamps.length > 20) {
    timestamps.shift();
  }

  // Need at least 10 taps to analyze
  if (timestamps.length < 10) {
    return { isBot: false, flags: [], tapsPerMinute: 0 };
  }

  const flags = [];

  // Calculate intervals between taps
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const tapsPerMinute = 60000 / avg;

  // Flag 1: Intervals too short (< 200ms avg = 300+ taps/min)
  if (avg < 200) {
    flags.push('avg_interval_too_short');
  }

  // Flag 2: Very consistent intervals (bot-like precision)
  if (stdDev < 50 && avg < 500) {
    flags.push('consistent_intervals');
  }

  // Flag 3: Extreme tap rate
  if (tapsPerMinute > 150) {
    flags.push('extreme_tap_rate');
  }

  return {
    isBot: flags.length >= 2,
    flags,
    tapsPerMinute: Math.round(tapsPerMinute)
  };
}

// Clean up old entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [userId, timestamps] of tapTimestamps.entries()) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < cutoff) {
      tapTimestamps.delete(userId);
    }
  }
}, 10 * 60 * 1000);

// POST /game/tap - Process a tap
router.post('/tap', tapRateLimit, async (req, res) => {
  try {
    // Get IP address for analytics
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;

    // Bot detection
    const botCheck = detectBot(req.user.id);

    if (botCheck.flags.length > 0) {
      console.log(`[SUSPICIOUS] User ${req.user.id}: ${botCheck.flags.join(', ')} (${botCheck.tapsPerMinute} taps/min)`);
    }

    // Shadow nerf: reduce XP for suspected bots
    let shadowMultiplier = 1;
    if (botCheck.flags.length >= 3) {
      shadowMultiplier = 0.1; // 10% XP
      console.log(`[SHADOW NERF] User ${req.user.id}: 10% XP (${botCheck.flags.join(', ')})`);
      // Auto-flag in DB
      await db.query(
        `UPDATE users SET is_flagged = true, flag_reason = $1 WHERE id = $2 AND is_flagged = false`,
        [`Auto-detected: ${botCheck.flags.join(', ')} (${botCheck.tapsPerMinute} taps/min)`, req.user.id]
      );
    } else if (botCheck.flags.length === 2) {
      shadowMultiplier = 0.5; // 50% XP
      console.log(`[SHADOW NERF] User ${req.user.id}: 50% XP (${botCheck.flags.join(', ')})`);
    }

    // Shadow limit: extreme tap rate returns fake success with 0 bricks
    const SHADOW_RATE_LIMIT = (req.user.isPremium || req.user.hasBattlePass) ? 200 : 80;
    if (botCheck.tapsPerMinute > SHADOW_RATE_LIMIT) {
      console.log(`[SHADOW LIMIT] User ${req.user.id}: ${botCheck.tapsPerMinute} taps/min > ${SHADOW_RATE_LIMIT} limit`);
      return res.json({
        success: true,
        bricks: 0,
        bricksEarned: 0,
        level: 0,
        energy: 0,
        leveledUp: false,
        newLevel: null,
        totalTaps: 0,
        isLevelCapped: false,
        isPremium: req.user.isPremium,
        hasBattlePass: req.user.hasBattlePass,
        boostMultiplier: 1,
        xpProgress: { current: 0, needed: 100, percent: 0 }
      });
    }

    // Get referral bonus multiplier for Battle Pass users
    let referralBonusMultiplier = 1;
    if (req.user.hasBattlePass) {
      const referralStats = await User.getVerifiedReferralStats(req.user.id);
      referralBonusMultiplier = referralStats.bonusMultiplier;
    }

    // Get quest bonus multiplier (KiiChain +20%, all users)
    const questBonusMultiplier = await GameProgress.getQuestBonus(req.user.id);

    const result = await GameProgress.processTap(
      req.user.id,
      req.user.isPremium,
      req.user.hasBattlePass,
      referralBonusMultiplier,
      questBonusMultiplier,
      null, // sessionId
      ipAddress,
      shadowMultiplier // Pass shadow multiplier
    );

    // Check if boost is still active (or Battle Pass permanent X5)
    const now = new Date();
    const boostExpiresAt = result.boost_expires_at ? new Date(result.boost_expires_at) : null;
    const isBoostActive = boostExpiresAt && boostExpiresAt > now;

    // Battle Pass users always have X5 active
    const effectiveBoostMultiplier = req.user.hasBattlePass ? 5 : (isBoostActive ? parseFloat(result.boost_multiplier) : 1);
    const effectiveBoostType = req.user.hasBattlePass ? 'battle_pass' : (isBoostActive ? result.boost_type : null);

    res.json({
      success: true,
      bricks: result.bricks,
      bricksEarned: result.bricksEarned,
      level: result.level,
      energy: result.energy,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      totalTaps: result.total_taps,
      isLevelCapped: result.isLevelCapped,
      maxFreeLevel: result.maxFreeLevel,
      isPremium: req.user.isPremium,
      hasBattlePass: req.user.hasBattlePass,
      boostMultiplier: effectiveBoostMultiplier,
      boostExpiresAt: req.user.hasBattlePass ? null : (isBoostActive ? boostExpiresAt.toISOString() : null),
      boostType: effectiveBoostType,
      isBoostActive: isBoostActive || req.user.hasBattlePass,
      xpProgress: result.xpProgress,
      referralBonusMultiplier: req.user.hasBattlePass ? referralBonusMultiplier : 1,
      questBonusMultiplier
    });
  } catch (error) {
    if (error.message === 'Tap cooldown active') {
      return res.status(429).json({ error: 'Wait before tapping again' });
    }
    if (error.message === 'No energy left') {
      return res.status(400).json({ error: 'No energy left. Wait for regeneration or go premium!' });
    }
    console.error('Tap error:', error);
    res.status(500).json({ error: 'Failed to process tap' });
  }
});

// POST /game/claim - Claim PME tokens
router.post('/claim', async (req, res) => {
  try {
    const result = await GameProgress.claimTokens(req.user.id);

    res.json({
      success: true,
      tokensClaimed: result.tokensClaimed,
      newBricks: result.progress.bricks,
      totalTokens: result.progress.pme_tokens
    });
  } catch (error) {
    if (error.message.includes('Minimum')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Claim error:', error);
    res.status(500).json({ error: 'Failed to claim tokens' });
  }
});

// GET /game/leaderboard - Get top players
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    // Check if active season is frozen - serve snapshot instead
    const frozenCheck = await db.query(
      'SELECT frozen_snapshot FROM leaderboard_seasons WHERE is_active = true AND is_frozen = true LIMIT 1'
    ).catch(() => ({ rows: [] }));

    if (frozenCheck.rows.length > 0 && frozenCheck.rows[0].frozen_snapshot) {
      const snapshot = frozenCheck.rows[0].frozen_snapshot;
      const formatted = snapshot.slice(0, limit).map(p => ({
        rank: p.rank,
        address: p.wallet_address,
        username: p.username,
        bricks: p.bricks,
        level: p.level,
        isPremium: p.is_premium
      }));
      return res.json({ leaderboard: formatted, frozen: true });
    }

    const leaderboard = await User.getLeaderboard(limit);

    // Format for frontend
    const formatted = leaderboard.map((player, index) => ({
      rank: index + 1,
      address: player.wallet_address,
      username: player.username,
      bricks: player.bricks,
      level: player.level,
      isPremium: player.is_premium
    }));

    res.json({ leaderboard: formatted });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// POST /game/energy/regen - Manual energy regeneration (for testing)
router.post('/energy/regen', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Not available in production' });
  }

  try {
    const newEnergy = await GameProgress.regenerateEnergy(req.user.id, 10);
    res.json({ success: true, energy: newEnergy });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate energy' });
  }
});

module.exports = router;

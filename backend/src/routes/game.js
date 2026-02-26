const express = require('express');
const { authenticateToken, tapRateLimit } = require('../middleware/auth');
const User = require('../models/User');
const GameProgress = require('../models/GameProgress');
const { getXpProgress, calculateLevelFromXp, applyLevelCap, FREE_USER_MAX_LEVEL } = require('../models/GameProgress');
const db = require('../config/database');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

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

// POST /game/tap - Process a tap
router.post('/tap', tapRateLimit, async (req, res) => {
  try {
    // Get IP address for analytics
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || null;

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
      null, // sessionId - can be implemented later
      ipAddress
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

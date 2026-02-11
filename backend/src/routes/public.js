const express = require('express');
const cors = require('cors');
const db = require('../config/database');

const router = express.Router();

// Open CORS for all origins (public API)
router.use(cors({ origin: '*' }));

// ========== RATE LIMITING (60 req/min per IP) ==========
const rateLimits = new Map();
const PUBLIC_RATE_LIMIT = 60;
const PUBLIC_RATE_WINDOW = 60000;

router.use((req, res, next) => {
  const key = `public:${req.ip}`;
  const now = Date.now();

  if (!rateLimits.has(key)) {
    rateLimits.set(key, { count: 1, resetAt: now + PUBLIC_RATE_WINDOW });
    return next();
  }

  const limit = rateLimits.get(key);

  if (now > limit.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + PUBLIC_RATE_WINDOW });
    return next();
  }

  if (limit.count >= PUBLIC_RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((limit.resetAt - now) / 1000),
      limit: PUBLIC_RATE_LIMIT,
      window: '60s',
    });
  }

  limit.count++;
  next();
});

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimits) {
    if (now > val.resetAt) rateLimits.delete(key);
  }
}, 300000);

// ========== HELPERS ==========
function normalizeAddress(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  return address.toLowerCase();
}

async function findUserWithProgress(address) {
  const result = await db.query(
    `SELECT u.id, u.wallet_address, u.is_premium, u.premium_expires_at,
            u.has_battle_pass, u.battle_pass_expires_at, u.created_at,
            gp.level, gp.bricks, gp.total_taps, gp.total_bricks_earned, gp.xp
     FROM users u
     LEFT JOIN game_progress gp ON u.id = gp.user_id
     WHERE LOWER(u.wallet_address) = $1`,
    [address]
  );
  return result.rows[0] || null;
}

function isPremiumActive(user) {
  if (!user || !user.is_premium) return false;
  if (!user.premium_expires_at) return true; // permanent
  return new Date(user.premium_expires_at) > new Date();
}

function isBattlePassActive(user) {
  if (!user || !user.has_battle_pass) return false;
  if (!user.battle_pass_expires_at) return false;
  return new Date(user.battle_pass_expires_at) > new Date();
}

// ========== ENDPOINTS ==========

// GET /public/check/premium/:address
router.get('/check/premium/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const user = await findUserWithProgress(address);
    if (!user) return res.json({ exists: false, wallet: address, isPremium: false });

    const active = isPremiumActive(user);
    res.json({
      exists: true,
      wallet: address,
      isPremium: active,
      premiumExpiresAt: user.premium_expires_at || null,
      isPermanent: user.is_premium && !user.premium_expires_at,
    });
  } catch (error) {
    console.error('[Public API] Premium check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /public/check/battlepass/:address
router.get('/check/battlepass/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const user = await findUserWithProgress(address);
    if (!user) return res.json({ exists: false, wallet: address, hasBattlePass: false });

    const active = isBattlePassActive(user);
    res.json({
      exists: true,
      wallet: address,
      hasBattlePass: active,
      battlePassExpiresAt: user.battle_pass_expires_at || null,
      daysRemaining: active
        ? Math.ceil((new Date(user.battle_pass_expires_at) - new Date()) / (1000 * 60 * 60 * 24))
        : 0,
    });
  } catch (error) {
    console.error('[Public API] Battle Pass check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /public/check/paid/:address - Premium OR Battle Pass
router.get('/check/paid/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const user = await findUserWithProgress(address);
    if (!user) return res.json({ exists: false, wallet: address, hasPaid: false });

    const premium = isPremiumActive(user);
    const battlePass = isBattlePassActive(user);
    res.json({
      exists: true,
      wallet: address,
      hasPaid: premium || battlePass,
      isPremium: premium,
      hasBattlePass: battlePass,
    });
  } catch (error) {
    console.error('[Public API] Paid check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /public/check/level/:address
router.get('/check/level/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const user = await findUserWithProgress(address);
    if (!user) return res.json({ exists: false, wallet: address, level: 0 });

    const minLevel = req.query.min ? parseInt(req.query.min) : null;
    res.json({
      exists: true,
      wallet: address,
      level: user.level || 1,
      meetsRequirement: minLevel ? (user.level || 1) >= minLevel : true,
    });
  } catch (error) {
    console.error('[Public API] Level check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /public/check/taps/:address
router.get('/check/taps/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const user = await findUserWithProgress(address);
    if (!user) return res.json({ exists: false, wallet: address, totalTaps: 0 });

    const minTaps = req.query.min ? parseInt(req.query.min) : null;
    res.json({
      exists: true,
      wallet: address,
      totalTaps: parseInt(user.total_taps) || 0,
      totalBricksEarned: parseInt(user.total_bricks_earned) || 0,
      meetsRequirement: minTaps ? (parseInt(user.total_taps) || 0) >= minTaps : true,
    });
  } catch (error) {
    console.error('[Public API] Taps check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /public/check/quest/:questId/:address
router.get('/check/quest/:questId/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const { questId } = req.params;

    // Find user
    const userResult = await db.query(
      'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
      [address]
    );
    if (!userResult.rows[0]) return res.json({ exists: false, wallet: address, questCompleted: false });

    // Check quest completion
    const completionResult = await db.query(
      'SELECT completed_at, xp_earned FROM quest_completions WHERE user_id = $1 AND quest_id = $2',
      [userResult.rows[0].id, questId]
    );

    const completion = completionResult.rows[0];
    res.json({
      exists: true,
      wallet: address,
      questId,
      questCompleted: !!completion,
      completedAt: completion?.completed_at || null,
      xpEarned: completion?.xp_earned || 0,
    });
  } catch (error) {
    console.error('[Public API] Quest check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /public/check/profile/:address - Complete profile
router.get('/check/profile/:address', async (req, res) => {
  try {
    const address = normalizeAddress(req.params.address);
    if (!address) return res.status(400).json({ error: 'Invalid wallet address', exists: false });

    const user = await findUserWithProgress(address);
    if (!user) return res.json({ exists: false, wallet: address });

    // Count completed quests
    const questResult = await db.query(
      'SELECT COUNT(*) as count, COALESCE(SUM(xp_earned), 0) as total_xp FROM quest_completions WHERE user_id = $1',
      [user.id]
    );

    const premium = isPremiumActive(user);
    const battlePass = isBattlePassActive(user);

    res.json({
      exists: true,
      wallet: address,
      level: user.level || 1,
      xp: user.xp || 0,
      bricks: user.bricks || 0,
      totalTaps: parseInt(user.total_taps) || 0,
      totalBricksEarned: parseInt(user.total_bricks_earned) || 0,
      isPremium: premium,
      hasBattlePass: battlePass,
      hasPaid: premium || battlePass,
      questsCompleted: parseInt(questResult.rows[0].count) || 0,
      questXP: parseInt(questResult.rows[0].total_xp) || 0,
      joinedAt: user.created_at,
    });
  } catch (error) {
    console.error('[Public API] Profile check error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

const express = require('express');
const { authenticateToken, tapRateLimit } = require('../middleware/auth');
const User = require('../models/User');
const GameProgress = require('../models/GameProgress');

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

    const FREE_USER_MAX_LEVEL = 3;
    const isLevelCapped = !req.user.isPremium && progress.level >= FREE_USER_MAX_LEVEL;

    // Check if boost is active
    const now = new Date();
    const boostExpiresAt = progress.boost_expires_at ? new Date(progress.boost_expires_at) : null;
    const isBoostActive = boostExpiresAt && boostExpiresAt > now;
    const activeMultiplier = isBoostActive ? parseFloat(progress.boost_multiplier) : 1;

    res.json({
      bricks: progress.bricks,
      level: progress.level,
      pmeTokens: progress.pme_tokens,
      energy: progress.energy,
      maxEnergy: progress.max_energy || 100,
      totalTaps: progress.total_taps,
      boostMultiplier: activeMultiplier,
      boostExpiresAt: isBoostActive ? boostExpiresAt.toISOString() : null,
      boostType: isBoostActive ? progress.boost_type : null,
      isBoostActive,
      rank,
      isPremium: req.user.isPremium,
      isLevelCapped,
      maxFreeLevel: FREE_USER_MAX_LEVEL
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

    const result = await GameProgress.processTap(
      req.user.id,
      req.user.isPremium,
      null, // sessionId - can be implemented later
      ipAddress
    );

    // Check if boost is still active
    const now = new Date();
    const boostExpiresAt = result.boost_expires_at ? new Date(result.boost_expires_at) : null;
    const isBoostActive = boostExpiresAt && boostExpiresAt > now;

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
      boostMultiplier: isBoostActive ? parseFloat(result.boost_multiplier) : 1,
      boostExpiresAt: isBoostActive ? boostExpiresAt.toISOString() : null,
      boostType: isBoostActive ? result.boost_type : null,
      isBoostActive
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

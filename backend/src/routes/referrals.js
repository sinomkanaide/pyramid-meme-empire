const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /referrals/stats - Get referral statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await User.getVerifiedReferralStats(req.user.id);
    const referralCode = await User.getReferralCode(req.user.id);

    res.json({
      referralCode,
      total: stats.total,
      verified: stats.verified,
      bonusPercent: stats.bonusPercent,
      bonusMultiplier: stats.bonusMultiplier,
      // Generate referral link
      referralLink: `${process.env.FRONTEND_URL || 'https://pyramidmeme.com'}?ref=${referralCode}`
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats' });
  }
});

// GET /referrals/list - Get list of referrals
router.get('/list', async (req, res) => {
  try {
    const { Pool } = require('pg');
    const db = require('../config/database');

    const result = await db.query(
      `SELECT
        r.id,
        r.is_activated,
        r.activation_type,
        r.created_at,
        r.activated_at,
        u.wallet_address,
        u.username
       FROM referrals r
       JOIN users u ON r.referred_id = u.id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const referrals = result.rows.map(r => ({
      id: r.id,
      walletAddress: r.wallet_address,
      username: r.username,
      isVerified: r.is_activated,
      activationType: r.activation_type,
      joinedAt: r.created_at,
      verifiedAt: r.activated_at
    }));

    res.json({ referrals });
  } catch (error) {
    console.error('Get referrals list error:', error);
    res.status(500).json({ error: 'Failed to get referrals list' });
  }
});

// GET /referrals/code - Get user's referral code
router.get('/code', async (req, res) => {
  try {
    const referralCode = await User.getReferralCode(req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'https://pyramidmeme.com';

    res.json({
      code: referralCode,
      link: `${frontendUrl}?ref=${referralCode}`,
      shareText: `Join me on Pyramid Meme Empire! Use my referral code: ${referralCode}`,
      twitterShareUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just got Pyramid Meme Empire Battle Pass! 🔥 Join me and earn bonus XP! #PyramidMemeEmpire #Web3Gaming`)}&url=${encodeURIComponent(`${frontendUrl}?ref=${referralCode}`)}`
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
});

module.exports = router;

const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const {
  verifySignature,
  generateAuthMessage,
  generateToken,
  authenticateToken
} = require('../middleware/auth');

const router = express.Router();

// Store nonces temporarily (in production, use Redis)
const nonces = new Map();

// GET /auth/nonce - Get nonce for wallet signature
router.get('/nonce/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const message = generateAuthMessage(walletAddress, nonce, timestamp);

  // Store nonce and timestamp for 5 minutes
  nonces.set(walletAddress.toLowerCase(), {
    nonce,
    timestamp,
    expiresAt: Date.now() + 300000
  });

  res.json({ message, nonce });
});

// POST /auth/verify - Verify signature and authenticate
router.post('/verify',
  body('walletAddress').isEthereumAddress(),
  body('signature').isString().isLength({ min: 130 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { walletAddress, signature } = req.body;
    // Handle referralCode - can be null, undefined, or a string
    const referralCode = req.body.referralCode || null;

    try {
      // Get stored nonce and timestamp
      const storedData = nonces.get(walletAddress.toLowerCase());

      if (!storedData || Date.now() > storedData.expiresAt) {
        return res.status(400).json({ error: 'Nonce expired or not found. Request a new one.' });
      }

      const message = generateAuthMessage(walletAddress, storedData.nonce, storedData.timestamp);

      // Verify signature
      if (!verifySignature(message, signature, walletAddress)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Clear used nonce
      nonces.delete(walletAddress.toLowerCase());

      // Find or create user
      let user = await User.findByWallet(walletAddress);
      let isNewUser = false;

      if (!user) {
        user = await User.create(walletAddress, referralCode);
        isNewUser = true;
      }

      // Generate JWT
      const token = generateToken(user.id, user.wallet_address);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          referralCode: user.referral_code,
          isPremium: user.is_premium,
          isNewUser
        }
      });
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
);

// GET /auth/me - Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const referralStats = await User.getReferralStats(req.user.id);

    res.json({
      user: {
        id: req.user.id,
        walletAddress: req.user.wallet_address,
        username: req.user.username,
        referralCode: req.user.referral_code,
        isPremium: req.user.isPremium,
        premiumExpiresAt: req.user.premium_expires_at,
        createdAt: req.user.created_at
      },
      referralStats
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// POST /auth/logout - Logout (client-side token removal, but we track it)
router.post('/logout', authenticateToken, (req, res) => {
  // In production, you might want to blacklist the token
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;

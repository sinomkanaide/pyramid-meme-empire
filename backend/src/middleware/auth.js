const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const User = require('../models/User');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check premium status
    const isPremium = await User.checkPremium(user.id);

    req.user = {
      ...user,
      isPremium
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Verify wallet signature for authentication
const verifySignature = (message, signature, expectedAddress) => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    return false;
  }
};

// Generate auth message for signing
const generateAuthMessage = (walletAddress, nonce, timestamp) => {
  return `Welcome to Pyramid Meme Empire!

Sign this message to authenticate your wallet.

Wallet: ${walletAddress}
Nonce: ${nonce}
Timestamp: ${timestamp}

This signature will not trigger any blockchain transaction or cost any gas fees.`;
};

// Generate JWT token
const generateToken = (userId, walletAddress) => {
  return jwt.sign(
    { userId, walletAddress },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Rate limiter middleware (simple in-memory)
const rateLimits = new Map();

const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();

    if (!rateLimits.has(key)) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const limit = rateLimits.get(key);

    if (now > limit.resetAt) {
      rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (limit.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((limit.resetAt - now) / 1000)
      });
    }

    limit.count++;
    next();
  };
};

// Tap rate limiter (stricter)
const tapRateLimit = rateLimit(30, 60000); // 30 taps per minute max

module.exports = {
  authenticateToken,
  verifySignature,
  generateAuthMessage,
  generateToken,
  rateLimit,
  tapRateLimit
};

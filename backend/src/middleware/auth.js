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

    // Check if user is banned
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Check premium and battle pass status
    const isPremium = await User.checkPremium(user.id);
    const hasBattlePass = await User.checkBattlePass(user.id);

    req.user = {
      ...user,
      isPremium,
      hasBattlePass
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
  return `Welcome to TAPKAMUN.FUN!

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

// Generate admin JWT token (shorter expiry, includes role)
const generateAdminToken = (walletAddress) => {
  return jwt.sign(
    { walletAddress, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// Verify admin JWT token
const adminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const adminWallet = process.env.ADMIN_WALLET;
    if (!adminWallet || decoded.walletAddress.toLowerCase() !== adminWallet.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized wallet' });
    }

    req.admin = { walletAddress: decoded.walletAddress, role: decoded.role };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired admin token' });
  }
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

// Tap rate limiter - different limits for premium vs free users
const tapRateLimit = (req, res, next) => {
  const key = req.user?.id || req.ip;
  const now = Date.now();

  // Premium users get 120 taps/min, free users get 30 taps/min
  const isPremium = req.user?.isPremium;
  const maxRequests = isPremium ? 120 : 30;
  const windowMs = 60000;

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

module.exports = {
  authenticateToken,
  verifySignature,
  generateAuthMessage,
  generateToken,
  generateAdminToken,
  adminAuth,
  rateLimit,
  tapRateLimit
};

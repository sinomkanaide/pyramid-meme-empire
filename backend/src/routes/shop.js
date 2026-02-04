const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const GameProgress = require('../models/GameProgress');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Shop items configuration
const SHOP_ITEMS = {
  battle_pass: {
    id: 'battle_pass',
    name: 'BATTLE PASS',
    description: 'X5 boost + 10% XP + Leaderboard access + Referral bonuses + Golden pyramid',
    price: 5.00, // USDC
    icon: '🏆',
    type: 'battle_pass',
    duration: 30 // days
  },
  premium: {
    id: 'premium',
    name: 'PREMIUM',
    description: 'Unlimited levels + No cooldown + No energy limit',
    price: 2.00, // USDC
    icon: '👑',
    type: 'subscription',
    duration: 30 // days
  },
  boost_2x: {
    id: 'boost_2x',
    name: 'BOOST X2',
    description: '2X bricks for 24 hours',
    price: 0.50,
    icon: '⚡',
    type: 'boost',
    multiplier: 2,
    duration: 24 // hours
  },
  boost_5x: {
    id: 'boost_5x',
    name: 'BOOST X5',
    description: '5X bricks for 24 hours',
    price: 1.50,
    icon: '🔥',
    type: 'boost',
    multiplier: 5,
    duration: 24 // hours
  },
  energy_refill: {
    id: 'energy_refill',
    name: 'ENERGY REFILL',
    description: 'Instantly refill energy to 100',
    price: 0.25,
    icon: '🔋',
    type: 'consumable'
  }
};

// All routes require authentication
router.use(authenticateToken);

// GET /shop/items - Get available shop items
router.get('/items', (req, res) => {
  const items = Object.values(SHOP_ITEMS).map(item => ({
    ...item,
    canPurchase: true // Could add logic to check if user already has item
  }));

  res.json({ items });
});

// POST /shop/purchase - Initiate purchase
router.post('/purchase',
  body('itemId').isString().isIn(Object.keys(SHOP_ITEMS)),
  body('txHash').isString().isLength({ min: 66, max: 66 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId, txHash } = req.body;
    const item = SHOP_ITEMS[itemId];

    try {
      // Check if transaction already processed
      const existingTx = await Transaction.findByTxHash(txHash);
      if (existingTx) {
        return res.status(400).json({ error: 'Transaction already processed' });
      }

      // Create pending transaction record
      const transaction = await Transaction.create(
        req.user.id,
        txHash,
        'purchase',
        item.price,
        itemId
      );

      // Verify the USDC transfer on-chain
      const verification = await Transaction.verifyUSDCTransfer(
        txHash,
        item.price,
        process.env.SHOP_WALLET_ADDRESS
      );

      if (!verification.verified) {
        await Transaction.updateStatus(txHash, 'failed');
        return res.status(400).json({
          error: 'Payment verification failed',
          reason: verification.reason
        });
      }

      // Payment verified - apply the purchase
      await Transaction.updateStatus(txHash, 'confirmed');

      let result = {};

      switch (item.type) {
        case 'subscription':
          await User.setPremium(req.user.id, item.duration);
          result = { message: 'Premium activated!', duration: item.duration };
          break;

        case 'boost':
          await GameProgress.applyBoost(req.user.id, item.multiplier, item.duration);
          result = { message: `${item.multiplier}X boost activated!`, duration: item.duration };
          break;

        case 'consumable':
          if (itemId === 'energy_refill') {
            await GameProgress.regenerateEnergy(req.user.id, 100);
            result = { message: 'Energy refilled to 100!' };
          }
          break;
      }

      res.json({
        success: true,
        transaction: {
          id: transaction.id,
          txHash: transaction.tx_hash,
          status: 'confirmed',
          item: itemId
        },
        ...result
      });
    } catch (error) {
      console.error('Purchase error:', error);
      res.status(500).json({ error: 'Failed to process purchase' });
    }
  }
);

// POST /shop/activate - Demo mode: Activate item without payment verification
// This is for testing. In production, use /purchase with real tx verification
router.post('/activate',
  body('itemId').isString().isIn(Object.keys(SHOP_ITEMS)),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { itemId } = req.body;
    const item = SHOP_ITEMS[itemId];

    try {
      // Generate a demo transaction hash
      const demoTxHash = `0xdemo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`.padEnd(66, '0');

      // Create transaction record with 'demo' status
      await Transaction.create(
        req.user.id,
        demoTxHash,
        'demo_purchase',
        item.price,
        itemId
      );

      // Get user and progress info for validations
      const user = await User.findById(req.user.id);
      const progress = await GameProgress.findByUserId(req.user.id);

      let result = {};
      let boostInfo = null;

      switch (item.type) {
        case 'battle_pass':
          // Check if already has Battle Pass
          const hasBattlePass = await User.checkBattlePass(req.user.id);
          if (hasBattlePass) {
            return res.status(400).json({
              error: 'You already have an active Battle Pass!',
              hasBattlePass: true
            });
          }

          // Activate Battle Pass
          const battlePassUser = await User.setBattlePass(req.user.id);

          // Mark referral as verified (if user was referred)
          const referrerId = await User.getReferrerId(req.user.id);
          if (referrerId) {
            await User.verifyReferral(req.user.id, 'battle_pass');
          }

          // Get referral code for sharing
          const referralCode = await User.getReferralCode(req.user.id);

          result = {
            message: 'Battle Pass activated for 30 days!',
            type: 'battle_pass',
            hasBattlePass: true,
            expiresAt: battlePassUser.battle_pass_expires_at,
            referralCode,
            features: [
              'Permanent X5 boost',
              '+10% XP bonus',
              'Leaderboard access',
              '+10% XP per verified referral',
              'Golden pyramid skin'
            ]
          };
          break;

        case 'subscription':
          // Check if already premium
          if (user.is_premium) {
            return res.status(400).json({
              error: 'You already have Premium!',
              isPremium: true
            });
          }

          await User.setPremium(req.user.id);

          // Mark referral as verified (if user was referred)
          const premiumReferrerId = await User.getReferrerId(req.user.id);
          if (premiumReferrerId) {
            await User.verifyReferral(req.user.id, 'premium');
          }

          result = {
            message: 'Premium activated forever!',
            type: 'premium',
            isPremium: true
          };
          break;

        case 'boost':
          const now = new Date();
          const currentBoostActive = progress.boost_expires_at && new Date(progress.boost_expires_at) > now;
          const currentMultiplier = currentBoostActive ? parseFloat(progress.boost_multiplier) : 1;

          // Check if trying to downgrade (X2 while X5 is active)
          if (item.multiplier < currentMultiplier) {
            return res.status(400).json({
              error: `Cannot downgrade: You already have a better boost active (X${currentMultiplier})`,
              currentBoost: currentMultiplier
            });
          }

          // Check if upgrading (X5 while X2 is active)
          const isUpgrade = currentBoostActive && item.multiplier > currentMultiplier;

          // Apply the boost (this will overwrite any existing boost)
          const boostResult = await GameProgress.applyBoost(req.user.id, item.multiplier, item.duration);
          boostInfo = {
            multiplier: item.multiplier,
            expiresAt: boostResult.boost_expires_at,
            type: item.id
          };

          if (isUpgrade) {
            result = {
              message: `Boost upgraded! X${currentMultiplier} → X${item.multiplier}`,
              boost: boostInfo,
              upgraded: true,
              from: currentMultiplier,
              to: item.multiplier
            };
          } else {
            result = {
              message: `${item.multiplier}X boost activated for 24 hours!`,
              boost: boostInfo,
              upgraded: false
            };
          }
          break;

        case 'consumable':
          if (itemId === 'energy_refill') {
            // Check if user is premium or has Battle Pass (they have unlimited energy)
            const userHasBattlePass = await User.checkBattlePass(req.user.id);
            if (user.is_premium || userHasBattlePass) {
              return res.status(400).json({
                error: 'Premium and Battle Pass users have unlimited energy!',
                isPremium: user.is_premium,
                hasBattlePass: userHasBattlePass
              });
            }

            const newEnergy = await GameProgress.regenerateEnergy(req.user.id, 100);
            result = {
              message: 'Energy refilled to 100!',
              type: 'energy',
              energy: newEnergy
            };
          }
          break;
      }

      // Update transaction as confirmed
      await Transaction.updateStatus(demoTxHash, 'confirmed');

      res.json({
        success: true,
        item: {
          id: item.id,
          name: item.name,
          price: item.price
        },
        ...result
      });
    } catch (error) {
      console.error('Activate error:', error);
      res.status(500).json({ error: 'Failed to activate item' });
    }
  }
);

// GET /shop/boost-status - Get current boost status
router.get('/boost-status', async (req, res) => {
  try {
    const progress = await GameProgress.findByUserId(req.user.id);

    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    const now = new Date();
    const boostExpiresAt = progress.boost_expires_at ? new Date(progress.boost_expires_at) : null;
    const isBoostActive = boostExpiresAt && boostExpiresAt > now;

    res.json({
      isActive: isBoostActive,
      multiplier: isBoostActive ? parseFloat(progress.boost_multiplier) : 1,
      expiresAt: isBoostActive ? boostExpiresAt.toISOString() : null,
      remainingSeconds: isBoostActive ? Math.floor((boostExpiresAt - now) / 1000) : 0,
      boostType: progress.boost_type
    });
  } catch (error) {
    console.error('Boost status error:', error);
    res.status(500).json({ error: 'Failed to get boost status' });
  }
});

// GET /shop/transactions - Get user's transaction history
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.findByUserId(req.user.id);

    res.json({
      transactions: transactions.map(tx => ({
        id: tx.id,
        txHash: tx.tx_hash,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        item: tx.item_name,
        createdAt: tx.created_at,
        confirmedAt: tx.confirmed_at
      }))
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// POST /shop/verify - Verify a pending transaction
router.post('/verify',
  body('txHash').isString().isLength({ min: 66, max: 66 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { txHash } = req.body;

    try {
      const transaction = await Transaction.findByTxHash(txHash);

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not your transaction' });
      }

      const verification = await Transaction.verifyOnChain(txHash);

      res.json({
        transaction: {
          id: transaction.id,
          status: transaction.status,
          item: transaction.item_name
        },
        onChain: verification
      });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ error: 'Failed to verify transaction' });
    }
  }
);

module.exports = router;

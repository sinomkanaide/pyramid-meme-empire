const db = require('../config/database');
const { xpForLevel, calculateLevelFromXp, getXpProgress, applyLevelCap, FREE_USER_MAX_LEVEL } = require('../utils/levelCalculations');

class GameProgress {
  // Get progress by user ID
  static async findByUserId(userId) {
    const result = await db.query(
      'SELECT * FROM game_progress WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  }

  // Process a tap
  // hasBattlePass: grants X5 boost, +10% XP, no cooldown, no energy use
  // referralBonusMultiplier: 1.0 base + 0.1 per verified referral (e.g., 1.3 = +30%)
  // questBonusMultiplier: 1.2 if KiiChain quest completed (active), 1.0 otherwise
  static async processTap(userId, isPremium = false, hasBattlePass = false, referralBonusMultiplier = 1, questBonusMultiplier = 1, sessionId = null, ipAddress = null) {
    const progress = await this.findByUserId(userId);

    if (!progress) {
      throw new Error('Game progress not found');
    }

    const now = new Date();
    const lastTap = progress.last_tap_at ? new Date(progress.last_tap_at) : null;

    // Battle Pass and Premium users have no cooldown
    const hasNoCooldown = isPremium || hasBattlePass;

    // Check cooldown (2 seconds for free users)
    if (!hasNoCooldown && lastTap) {
      const timeSinceLastTap = now - lastTap;
      if (timeSinceLastTap < 2000) {
        throw new Error('Tap cooldown active');
      }
    }

    // Battle Pass and Premium users have unlimited energy
    const hasUnlimitedEnergy = isPremium || hasBattlePass;

    // Check energy (free users only)
    if (!hasUnlimitedEnergy && progress.energy <= 0) {
      throw new Error('No energy left');
    }

    // Calculate boost multiplier
    let boostMultiplier = parseFloat(progress.boost_multiplier) || 1;
    if (progress.boost_expires_at && new Date(progress.boost_expires_at) < now) {
      boostMultiplier = 1;
      // Reset boost if expired
      await db.query(
        `UPDATE game_progress SET boost_multiplier = 1, boost_type = NULL WHERE user_id = $1`,
        [userId]
      );
    }

    // Battle Pass grants permanent X5 boost (if no better boost active)
    if (hasBattlePass && boostMultiplier < 5) {
      boostMultiplier = 5;
    }

    // Calculate XP/Bricks earned
    // Formula: baseXP * boostMultiplier * battlePassBonus * referralBonus * questBonus
    let baseXP = 1 * boostMultiplier;

    // Battle Pass: +10% XP bonus (1.1x)
    const battlePassBonus = hasBattlePass ? 1.1 : 1;

    // Referral bonus: +10% per verified referral (BP only)
    // Quest bonus: +20% from KiiChain (all users, independent)
    const totalMultiplier = baseXP * battlePassBonus * referralBonusMultiplier * questBonusMultiplier;
    const bricksEarned = Math.max(1, Math.floor(totalMultiplier));

    const energyUsed = hasUnlimitedEnergy ? 0 : 1;
    const newBricks = progress.bricks + bricksEarned;
    const newEnergy = hasUnlimitedEnergy ? progress.energy : Math.max(0, progress.energy - 1);

    // Calculate level using exponential formula
    const calculatedLevel = calculateLevelFromXp(newBricks);

    // FREE USER LEVEL CAP: Max level 3 without premium OR battle pass
    const newLevel = applyLevelCap(calculatedLevel, isPremium, hasBattlePass);
    const isLevelCapped = newLevel < calculatedLevel;

    // Get XP progress for frontend
    const xpProgress = getXpProgress(newBricks, newLevel);

    // Update game progress
    const result = await db.query(
      `UPDATE game_progress
       SET bricks = $1,
           level = $2,
           energy = $3,
           last_tap_at = NOW(),
           total_taps = total_taps + 1,
           total_bricks_earned = total_bricks_earned + $4,
           boost_multiplier = $5,
           updated_at = NOW()
       WHERE user_id = $6
       RETURNING *`,
      [newBricks, newLevel, newEnergy, bricksEarned, boostMultiplier, userId]
    );

    // Log tap to taps table for analytics
    await db.query(
      `INSERT INTO taps (user_id, bricks_earned, multiplier, energy_used, session_id, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, bricksEarned, boostMultiplier, energyUsed, sessionId, ipAddress]
    );

    const updated = result.rows[0];
    const leveledUp = newLevel > progress.level && !isLevelCapped;

    return {
      ...updated,
      bricksEarned,
      leveledUp,
      newLevel: leveledUp ? newLevel : null,
      isLevelCapped,
      maxFreeLevel: FREE_USER_MAX_LEVEL,
      xpProgress: {
        current: xpProgress.current,
        needed: xpProgress.needed,
        percent: xpProgress.percent
      }
    };
  }

  // Get quest bonus multiplier (check expiry)
  static async getQuestBonus(userId) {
    const progress = await this.findByUserId(userId);
    if (!progress) return 1;

    const now = new Date();
    const expiresAt = progress.quest_bonus_expires_at ? new Date(progress.quest_bonus_expires_at) : null;

    if (expiresAt && expiresAt > now) {
      return parseFloat(progress.quest_bonus_multiplier) || 1;
    }

    // Expired or not set
    return 1;
  }

  // Set quest bonus (e.g., KiiChain +20% for 30 days)
  static async setQuestBonus(userId, multiplier, durationDays) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const result = await db.query(
      `UPDATE game_progress
       SET quest_bonus_multiplier = $1,
           quest_bonus_expires_at = $2,
           updated_at = NOW()
       WHERE user_id = $3
       RETURNING *`,
      [multiplier, expiresAt, userId]
    );
    return result.rows[0];
  }

  // Regenerate energy (called periodically)
  static async regenerateEnergy(userId, amount = 1) {
    const result = await db.query(
      `UPDATE game_progress
       SET energy = LEAST(100, energy + $1),
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING energy`,
      [amount, userId]
    );
    return result.rows[0]?.energy;
  }

  // Apply boost
  static async applyBoost(userId, multiplier, durationHours = 24) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    // Determine boost type based on multiplier
    const boostType = multiplier === 2 ? 'x2' : multiplier === 5 ? 'x5' : `x${multiplier}`;

    const result = await db.query(
      `UPDATE game_progress
       SET boost_multiplier = $1,
           boost_expires_at = $2,
           boost_type = $3,
           updated_at = NOW()
       WHERE user_id = $4
       RETURNING *`,
      [multiplier, expiresAt, boostType, userId]
    );
    return result.rows[0];
  }

  // Get player rank
  static async getRank(userId) {
    const result = await db.query(
      `SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY bricks DESC) as rank
        FROM game_progress
      ) ranked
      WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0]?.rank || 0;
  }

  // Claim PME tokens (placeholder - actual token distribution TBD)
  static async claimTokens(userId) {
    const progress = await this.findByUserId(userId);

    if (!progress || progress.bricks < 100) {
      throw new Error('Minimum 100 bricks required to claim');
    }

    // Calculate tokens (1 brick = 1 PME for now)
    const tokensToAdd = progress.bricks;

    const result = await db.query(
      `UPDATE game_progress
       SET pme_tokens = pme_tokens + $1,
           bricks = 0,
           level = 1,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [tokensToAdd, userId]
    );

    return {
      tokensClaimed: tokensToAdd,
      progress: result.rows[0]
    };
  }
}

module.exports = GameProgress;
module.exports.xpForLevel = xpForLevel;
module.exports.getXpProgress = getXpProgress;
module.exports.calculateLevelFromXp = calculateLevelFromXp;
module.exports.applyLevelCap = applyLevelCap;
module.exports.FREE_USER_MAX_LEVEL = FREE_USER_MAX_LEVEL;

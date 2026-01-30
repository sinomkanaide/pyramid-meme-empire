const db = require('../config/database');

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
  static async processTap(userId, isPremium = false) {
    const progress = await this.findByUserId(userId);

    if (!progress) {
      throw new Error('Game progress not found');
    }

    const now = new Date();
    const lastTap = progress.last_tap_at ? new Date(progress.last_tap_at) : null;

    // Check cooldown (2 seconds for non-premium)
    if (!isPremium && lastTap) {
      const timeSinceLastTap = now - lastTap;
      if (timeSinceLastTap < 2000) {
        throw new Error('Tap cooldown active');
      }
    }

    // Check energy (non-premium only)
    if (!isPremium && progress.energy <= 0) {
      throw new Error('No energy left');
    }

    // Calculate multiplier
    let multiplier = parseFloat(progress.boost_multiplier) || 1;
    if (progress.boost_expires_at && new Date(progress.boost_expires_at) < now) {
      multiplier = 1;
    }

    const bricksEarned = Math.floor(1 * multiplier);
    const newBricks = progress.bricks + bricksEarned;
    const newLevel = Math.floor(newBricks / 100) + 1;
    const newEnergy = isPremium ? progress.energy : Math.max(0, progress.energy - 1);

    const result = await db.query(
      `UPDATE game_progress
       SET bricks = $1,
           level = $2,
           energy = $3,
           last_tap_at = NOW(),
           total_taps = total_taps + 1,
           boost_multiplier = $4,
           updated_at = NOW()
       WHERE user_id = $5
       RETURNING *`,
      [newBricks, newLevel, newEnergy, multiplier, userId]
    );

    const updated = result.rows[0];
    const leveledUp = newLevel > progress.level;

    return {
      ...updated,
      bricksEarned,
      leveledUp,
      newLevel: leveledUp ? newLevel : null
    };
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

    const result = await db.query(
      `UPDATE game_progress
       SET boost_multiplier = $1,
           boost_expires_at = $2,
           updated_at = NOW()
       WHERE user_id = $3
       RETURNING *`,
      [multiplier, expiresAt, userId]
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

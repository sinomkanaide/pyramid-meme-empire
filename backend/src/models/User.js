const db = require('../config/database');
const crypto = require('crypto');

class User {
  // Find user by wallet address
  static async findByWallet(walletAddress) {
    const result = await db.query(
      'SELECT * FROM users WHERE LOWER(wallet_address) = LOWER($1)',
      [walletAddress]
    );
    return result.rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  // Find user by referral code
  static async findByReferralCode(code) {
    const result = await db.query(
      'SELECT * FROM users WHERE referral_code = $1',
      [code]
    );
    return result.rows[0];
  }

  // Create new user
  static async create(walletAddress, referredByCode = null) {
    const referralCode = crypto.randomBytes(5).toString('hex').toUpperCase();

    let referredById = null;
    if (referredByCode) {
      const referrer = await this.findByReferralCode(referredByCode);
      if (referrer) {
        referredById = referrer.id;
      }
    }

    const result = await db.query(
      `INSERT INTO users (wallet_address, referral_code, referred_by)
       VALUES (LOWER($1), $2, $3)
       RETURNING *`,
      [walletAddress, referralCode, referredById]
    );

    const user = result.rows[0];

    // Create initial game progress
    await db.query(
      'INSERT INTO game_progress (user_id) VALUES ($1)',
      [user.id]
    );

    // Create referral record if referred
    if (referredById) {
      await db.query(
        'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)',
        [referredById, user.id]
      );
    }

    return user;
  }

  // Update premium status
  static async setPremium(userId, durationDays = 30) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const result = await db.query(
      `UPDATE users
       SET is_premium = TRUE, premium_expires_at = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [expiresAt, userId]
    );
    return result.rows[0];
  }

  // Check if premium is active
  static async checkPremium(userId) {
    const result = await db.query(
      `SELECT is_premium, premium_expires_at FROM users WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];

    if (!user || !user.is_premium) return false;
    if (!user.premium_expires_at) return true;

    return new Date(user.premium_expires_at) > new Date();
  }

  // Get referral stats
  static async getReferralStats(userId) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_invited,
        COUNT(CASE WHEN is_activated THEN 1 END) as total_activated
       FROM referrals
       WHERE referrer_id = $1`,
      [userId]
    );

    const stats = result.rows[0];
    const boostPercent = parseInt(stats.total_activated) * 10; // 10% per activated referral

    return {
      invited: parseInt(stats.total_invited),
      activated: parseInt(stats.total_activated),
      boostPercent
    };
  }

  // Get leaderboard (top players by bricks)
  static async getLeaderboard(limit = 10) {
    const result = await db.query(
      `SELECT
        u.wallet_address,
        u.username,
        u.is_premium,
        gp.bricks,
        gp.level
       FROM users u
       JOIN game_progress gp ON u.id = gp.user_id
       ORDER BY gp.bricks DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

module.exports = User;

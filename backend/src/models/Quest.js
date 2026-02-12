const db = require('../config/database');
const { calculateLevelFromXp } = require('./GameProgress');

// Default XP rewards (used when reward_amount is null in DB)
const XP_REWARDS = {
  'twitter_follow': 50,
  'twitter_like': 25,
  'twitter_retweet': 50,
  'discord_join': 50,
  'telegram_join': 50,
  'level_milestone': 100,
  'tap_milestone': 75,
  'referral_milestone': 150,
  'partner_quest': 0
};

class Quest {
  // Check if tables exist
  static async tablesExist() {
    try {
      const questsTable = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'quests'
        )
      `);
      const completionsTable = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'quest_completions'
        )
      `);
      return {
        quests: questsTable.rows[0].exists,
        quest_completions: completionsTable.rows[0].exists
      };
    } catch (error) {
      console.error('Error checking tables:', error);
      return { quests: false, quest_completions: false, error: error.message };
    }
  }

  // Transform DB quest to frontend format
  static transformQuest(dbQuest) {
    if (!dbQuest) return null;

    // Get XP reward (parseInt to handle NUMERIC column returning "35.0000000")
    const xpReward = dbQuest.requirement_type === 'partner_quest'
      ? 0
      : (parseInt(dbQuest.reward_amount) || XP_REWARDS[dbQuest.requirement_type] || 50);

    // Determine verification method
    let verificationMethod = 'manual'; // default: social quests (GO + VERIFY)
    const reqType = dbQuest.requirement_type || '';

    // Game/milestone quests - auto-verified by backend (CLAIM button only)
    if (reqType.includes('milestone') || reqType.includes('referral') ||
        reqType.includes('tap') || reqType.includes('purchase') ||
        reqType.includes('brick') || reqType.includes('stack') ||
        reqType.includes('level')) {
      verificationMethod = 'internal';
    }

    // Partner quests override
    if (reqType === 'partner_quest') {
      if (dbQuest.requirement_metadata?.api_endpoint) {
        verificationMethod = 'partner_api';
      } else {
        verificationMethod = 'kiichain_api';
      }
    }

    // Get external URL from metadata
    const externalUrl = dbQuest.requirement_metadata?.url || null;

    // Map quest_type to our type
    const type = dbQuest.quest_type || 'social';

    return {
      quest_id: String(dbQuest.id),
      id: dbQuest.id,
      title: dbQuest.title,
      description: dbQuest.description,
      type: type,
      verification_method: verificationMethod,
      xp_reward: xpReward,
      external_url: externalUrl,
      icon: dbQuest.icon || '🎯',
      is_active: dbQuest.is_active !== false,
      sort_order: dbQuest.sort_order || 0,
      // Keep original fields too
      quest_type: dbQuest.quest_type,
      requirement_type: dbQuest.requirement_type,
      requirement_value: dbQuest.requirement_value,
      requirement_metadata: dbQuest.requirement_metadata
    };
  }

  // Initialize quest_completions table (quests table already exists with different schema)
  static async initializeTables() {
    console.log('Initializing quest_completions table...');

    // Only create quest_completions table - quests table already exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS quest_completions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        quest_id VARCHAR(50) NOT NULL,
        completed_at TIMESTAMP DEFAULT NOW(),
        xp_earned INTEGER NOT NULL DEFAULT 0,
        is_verified BOOLEAN DEFAULT false,
        UNIQUE(user_id, quest_id)
      )
    `);

    // Create index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_quest_completions_user
      ON quest_completions(user_id)
    `);

    console.log('Quest_completions table initialized');
  }

  // Get all active quests
  static async getAllActive() {
    try {
      const result = await db.query(`
        SELECT * FROM quests
        WHERE is_active = true
        ORDER BY sort_order ASC
      `);
      return result.rows.map(q => this.transformQuest(q));
    } catch (error) {
      console.error('getAllActive error:', error.message);
      throw new Error(`Failed to get quests: ${error.message}`);
    }
  }

  // Get quest by ID (can be numeric id or string quest_id)
  static async findByQuestId(questId) {
    try {
      // Try to find by numeric id first
      const numericId = parseInt(questId);
      let result;

      if (!isNaN(numericId)) {
        result = await db.query(
          'SELECT * FROM quests WHERE id = $1',
          [numericId]
        );
      }

      if (!result || result.rows.length === 0) {
        // Try by string id (for backward compatibility)
        result = await db.query(
          'SELECT * FROM quests WHERE id::text = $1',
          [String(questId)]
        );
      }

      return result.rows[0] ? this.transformQuest(result.rows[0]) : null;
    } catch (error) {
      console.error('findByQuestId error:', error.message);
      return null;
    }
  }

  // Get user's completed quests
  static async getUserCompletions(userId) {
    try {
      const result = await db.query(`
        SELECT qc.*, q.title, q.quest_type as type, q.icon
        FROM quest_completions qc
        LEFT JOIN quests q ON qc.quest_id::integer = q.id
        WHERE qc.user_id = $1
        ORDER BY qc.completed_at DESC
      `, [userId]);
      return result.rows;
    } catch (error) {
      console.error('getUserCompletions error:', error.message);
      return [];
    }
  }

  // Check if user has completed a quest
  static async isCompleted(userId, questId) {
    try {
      const result = await db.query(
        'SELECT id FROM quest_completions WHERE user_id = $1 AND quest_id = $2',
        [userId, String(questId)]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('isCompleted error:', error.message);
      return false;
    }
  }

  // Complete a quest for user
  static async complete(userId, questId, xpEarned, isPremium = false) {
    try {
      const xp = parseInt(xpEarned) || 0;

      const result = await db.query(`
        INSERT INTO quest_completions (user_id, quest_id, xp_earned, is_verified)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (user_id, quest_id) DO NOTHING
        RETURNING *
      `, [userId, String(questId), xp]);

      if (result.rows.length === 0) {
        return null; // Already completed
      }

      // Add XP and recalculate level
      const updated = await db.query(`
        UPDATE game_progress
        SET bricks = bricks + $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING bricks
      `, [xp, userId]);

      if (updated.rows.length > 0) {
        const newBricks = parseInt(updated.rows[0].bricks) || 0;
        const calculatedLevel = calculateLevelFromXp(newBricks);
        const FREE_USER_MAX_LEVEL = 3;
        const newLevel = (!isPremium && calculatedLevel > FREE_USER_MAX_LEVEL)
          ? FREE_USER_MAX_LEVEL : calculatedLevel;
        await db.query(
          'UPDATE game_progress SET level = $1 WHERE user_id = $2',
          [newLevel, userId]
        );
      }

      return result.rows[0];
    } catch (error) {
      console.error('complete error:', error.message);
      return null;
    }
  }

  // Get user's progress for milestone quests
  static async getUserProgress(userId) {
    let progress = { level: 1, total_taps: 0, bricks: 0, total_bricks_earned: 0 };
    let verifiedReferrals = 0;
    let purchaseCount = 0;

    try {
      const progressResult = await db.query(`
        SELECT gp.level, gp.total_taps, gp.bricks, gp.total_bricks_earned
        FROM game_progress gp
        WHERE gp.user_id = $1
      `, [userId]);
      progress = progressResult.rows[0] || progress;
    } catch (error) {
      console.error('getUserProgress - game_progress error:', error.message);
    }

    try {
      const referralsResult = await db.query(`
        SELECT COUNT(*) as verified_count
        FROM referrals
        WHERE referrer_id = $1 AND is_activated = true
      `, [userId]);
      verifiedReferrals = parseInt(referralsResult.rows[0]?.verified_count || 0);
    } catch (error) {
      console.error('getUserProgress - referrals error:', error.message);
    }

    try {
      const purchaseResult = await db.query(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE user_id = $1 AND status = 'confirmed'
      `, [userId]);
      purchaseCount = parseInt(purchaseResult.rows[0]?.count || 0);
    } catch (error) {
      console.error('getUserProgress - purchases error:', error.message);
    }

    return {
      level: progress.level || 1,
      totalTaps: progress.total_taps || 0,
      totalBricks: progress.bricks || 0,
      totalBricksEarned: parseInt(progress.total_bricks_earned) || 0,
      verifiedReferrals,
      purchaseCount
    };
  }

  // Check if user can complete an internal quest
  static async canComplete(userId, questId) {
    const quest = await this.findByQuestId(questId);
    if (!quest) return { canComplete: true, current: 0, required: 0, progressText: null };

    // Social quests can always be "completed" (manual verification)
    if (quest.verification_method === 'manual') {
      return { canComplete: true, current: 0, required: 0, progressText: null };
    }

    const progress = await this.getUserProgress(userId);
    const reqType = quest.requirement_type || '';
    const reqValue = quest.requirement_value || 1;

    // Check based on requirement_type from DB
    if (reqType.includes('level')) {
      return {
        canComplete: progress.level >= reqValue,
        current: progress.level,
        required: reqValue,
        progressText: `${progress.level}/${reqValue} levels`
      };
    }

    if (reqType.includes('tap')) {
      return {
        canComplete: progress.totalTaps >= reqValue,
        current: progress.totalTaps,
        required: reqValue,
        progressText: `${progress.totalTaps.toLocaleString()}/${reqValue.toLocaleString()} taps`
      };
    }

    if (reqType.includes('referral')) {
      return {
        canComplete: progress.verifiedReferrals >= reqValue,
        current: progress.verifiedReferrals,
        required: reqValue,
        progressText: `${progress.verifiedReferrals}/${reqValue} verified friends`
      };
    }

    if (reqType.includes('brick') || reqType.includes('stack')) {
      return {
        canComplete: progress.totalBricksEarned >= reqValue,
        current: progress.totalBricksEarned,
        required: reqValue,
        progressText: `${progress.totalBricksEarned.toLocaleString()}/${reqValue.toLocaleString()} bricks`
      };
    }

    if (reqType.includes('purchase')) {
      return {
        canComplete: progress.purchaseCount >= reqValue,
        current: progress.purchaseCount,
        required: reqValue,
        progressText: `${progress.purchaseCount}/${reqValue} purchases`
      };
    }

    // Default: can complete
    return { canComplete: true, current: 0, required: 0, progressText: null };
  }

  // Get all quests with user status
  static async getAllWithUserStatus(userId) {
    const quests = await this.getAllActive();
    const completions = await this.getUserCompletions(userId);
    const completedIds = new Set(completions.map(c => String(c.quest_id)));

    const questsWithStatus = await Promise.all(
      quests.map(async (quest) => {
        const canComplete = await this.canComplete(userId, quest.quest_id);
        return {
          ...quest,
          isCompleted: completedIds.has(quest.quest_id),
          ...canComplete
        };
      })
    );

    return questsWithStatus;
  }

  // Get user's total XP from quests
  static async getTotalQuestXP(userId) {
    try {
      const result = await db.query(`
        SELECT COALESCE(SUM(xp_earned), 0) as total_xp
        FROM quest_completions
        WHERE user_id = $1
      `, [userId]);
      return parseInt(result.rows[0]?.total_xp || 0);
    } catch (error) {
      console.error('getTotalQuestXP error:', error.message);
      return 0;
    }
  }
}

module.exports = Quest;

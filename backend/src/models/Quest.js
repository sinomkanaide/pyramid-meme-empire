const db = require('../config/database');

// Initial quests data
const INITIAL_QUESTS = [
  {
    quest_id: 'follow_x',
    title: 'Follow @PyramidMeme on X',
    description: 'Follow our official X account',
    type: 'social',
    verification_method: 'manual',
    xp_reward: 500,
    external_url: 'https://twitter.com/pyramidmeme',
    icon: '🐦'
  },
  {
    quest_id: 'like_post',
    title: 'Like our pinned post',
    description: 'Like the pinned post on our X profile',
    type: 'social',
    verification_method: 'manual',
    xp_reward: 300,
    external_url: 'https://twitter.com/pyramidmeme',
    icon: '❤️'
  },
  {
    quest_id: 'retweet',
    title: 'Retweet announcement',
    description: 'Retweet our latest announcement',
    type: 'social',
    verification_method: 'manual',
    xp_reward: 800,
    external_url: 'https://twitter.com/pyramidmeme',
    icon: '🔄'
  },
  {
    quest_id: 'join_discord',
    title: 'Join Discord server',
    description: 'Join our community on Discord',
    type: 'social',
    verification_method: 'manual',
    xp_reward: 500,
    external_url: 'https://discord.gg/pyramidmeme',
    icon: '💬'
  },
  {
    quest_id: 'kiichain_testnet',
    title: 'Complete KiiChain Quest',
    description: 'Connect wallet on KiiChain testnet',
    type: 'partner_api',
    verification_method: 'manual',
    xp_reward: 3000,
    external_url: 'https://kiichain.io/testnet',
    icon: '🔗'
  },
  {
    quest_id: 'level_10',
    title: 'Reach Level 10',
    description: 'Level up your pyramid to level 10',
    type: 'milestone',
    verification_method: 'internal',
    xp_reward: 2000,
    external_url: null,
    icon: '🏆'
  },
  {
    quest_id: 'taps_1000',
    title: 'Make 1,000 taps',
    description: 'Tap on your pyramid 1,000 times',
    type: 'milestone',
    verification_method: 'internal',
    xp_reward: 1000,
    external_url: null,
    icon: '👆'
  },
  {
    quest_id: 'referrals_5',
    title: 'Invite 5 verified friends',
    description: 'Invite friends who purchase Premium or Battle Pass',
    type: 'referral',
    verification_method: 'internal',
    xp_reward: 2500,
    external_url: null,
    icon: '👥'
  }
];

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

  // Initialize quests table and seed data
  static async initializeTables() {
    console.log('Starting quest tables initialization...');

    // Create quests table
    console.log('Creating quests table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS quests (
        id SERIAL PRIMARY KEY,
        quest_id VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL,
        verification_method VARCHAR(20) NOT NULL,
        xp_reward INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        external_url TEXT,
        icon VARCHAR(10),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Quests table created/verified');

    // Create quest_completions table
    console.log('Creating quest_completions table...');
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
    console.log('Quest_completions table created/verified');

    // Create indexes
    console.log('Creating indexes...');
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_quest_completions_user
      ON quest_completions(user_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_quests_quest_id
      ON quests(quest_id)
    `);
    console.log('Indexes created/verified');

    // Seed initial quests
    console.log('Seeding initial quests...');
    for (let i = 0; i < INITIAL_QUESTS.length; i++) {
      const quest = INITIAL_QUESTS[i];
      try {
        await db.query(`
          INSERT INTO quests (quest_id, title, description, type, verification_method, xp_reward, external_url, icon, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (quest_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            type = EXCLUDED.type,
            verification_method = EXCLUDED.verification_method,
            xp_reward = EXCLUDED.xp_reward,
            external_url = EXCLUDED.external_url,
            icon = EXCLUDED.icon,
            sort_order = EXCLUDED.sort_order
        `, [
          quest.quest_id,
          quest.title,
          quest.description,
          quest.type,
          quest.verification_method,
          quest.xp_reward,
          quest.external_url,
          quest.icon,
          i
        ]);
        console.log(`  Seeded quest: ${quest.quest_id}`);
      } catch (seedError) {
        console.error(`  Error seeding quest ${quest.quest_id}:`, seedError.message);
      }
    }

    console.log('Quests tables initialized and seeded successfully');
  }

  // Get all active quests
  static async getAllActive() {
    try {
      const result = await db.query(`
        SELECT * FROM quests
        WHERE is_active = true
        ORDER BY sort_order ASC
      `);
      return result.rows;
    } catch (error) {
      console.error('getAllActive error:', error.message);
      throw new Error(`Failed to get quests: ${error.message}`);
    }
  }

  // Get quest by ID
  static async findByQuestId(questId) {
    const result = await db.query(
      'SELECT * FROM quests WHERE quest_id = $1',
      [questId]
    );
    return result.rows[0];
  }

  // Get user's completed quests
  static async getUserCompletions(userId) {
    try {
      const result = await db.query(`
        SELECT qc.*, q.title, q.type, q.icon
        FROM quest_completions qc
        JOIN quests q ON qc.quest_id = q.quest_id
        WHERE qc.user_id = $1
        ORDER BY qc.completed_at DESC
      `, [userId]);
      return result.rows;
    } catch (error) {
      console.error('getUserCompletions error:', error.message);
      // Return empty array if table doesn't exist or other error
      return [];
    }
  }

  // Check if user has completed a quest
  static async isCompleted(userId, questId) {
    const result = await db.query(
      'SELECT id FROM quest_completions WHERE user_id = $1 AND quest_id = $2',
      [userId, questId]
    );
    return result.rows.length > 0;
  }

  // Complete a quest for user
  static async complete(userId, questId, xpEarned) {
    const result = await db.query(`
      INSERT INTO quest_completions (user_id, quest_id, xp_earned, is_verified)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (user_id, quest_id) DO NOTHING
      RETURNING *
    `, [userId, questId, xpEarned]);

    if (result.rows.length === 0) {
      return null; // Already completed
    }

    // Add XP to user's game_progress (as bricks for now)
    await db.query(`
      UPDATE game_progress
      SET bricks = bricks + $1, updated_at = NOW()
      WHERE user_id = $2
    `, [xpEarned, userId]);

    return result.rows[0];
  }

  // Get user's progress for milestone quests
  static async getUserProgress(userId) {
    let progress = { level: 1, total_taps: 0, bricks: 0 };
    let verifiedReferrals = 0;

    // Get user's level and total taps
    try {
      const progressResult = await db.query(`
        SELECT gp.level, gp.total_taps, gp.bricks
        FROM game_progress gp
        WHERE gp.user_id = $1
      `, [userId]);
      progress = progressResult.rows[0] || progress;
    } catch (error) {
      console.error('getUserProgress - game_progress error:', error.message);
    }

    // Get verified referrals count
    try {
      const referralsResult = await db.query(`
        SELECT COUNT(*) as verified_count
        FROM referrals
        WHERE referrer_id = $1 AND is_activated = true
      `, [userId]);
      verifiedReferrals = parseInt(referralsResult.rows[0]?.verified_count || 0);
    } catch (error) {
      console.error('getUserProgress - referrals error:', error.message);
      // Table might not exist or have different structure, use 0
    }

    return {
      level: progress.level || 1,
      totalTaps: progress.total_taps || 0,
      totalBricks: progress.bricks || 0,
      verifiedReferrals
    };
  }

  // Check if user can complete an internal quest
  static async canComplete(userId, questId) {
    const progress = await this.getUserProgress(userId);

    switch (questId) {
      case 'level_10':
        return {
          canComplete: progress.level >= 10,
          current: progress.level,
          required: 10,
          progressText: `${progress.level}/10 levels`
        };

      case 'taps_1000':
        return {
          canComplete: progress.totalTaps >= 1000,
          current: progress.totalTaps,
          required: 1000,
          progressText: `${progress.totalTaps}/1,000 taps`
        };

      case 'referrals_5':
        return {
          canComplete: progress.verifiedReferrals >= 5,
          current: progress.verifiedReferrals,
          required: 5,
          progressText: `${progress.verifiedReferrals}/5 verified friends`
        };

      default:
        // Social and partner quests can always be "completed" (manual verification)
        return {
          canComplete: true,
          current: 0,
          required: 0,
          progressText: null
        };
    }
  }

  // Get quest with user status
  static async getQuestWithStatus(userId, questId) {
    const quest = await this.findByQuestId(questId);
    if (!quest) return null;

    const isCompleted = await this.isCompleted(userId, questId);
    const canComplete = await this.canComplete(userId, questId);

    return {
      ...quest,
      isCompleted,
      ...canComplete
    };
  }

  // Get all quests with user status
  static async getAllWithUserStatus(userId) {
    const quests = await this.getAllActive();
    const completions = await this.getUserCompletions(userId);
    const completedIds = new Set(completions.map(c => c.quest_id));

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
      return 0; // Return 0 if table doesn't exist
    }
  }
}

module.exports = Quest;

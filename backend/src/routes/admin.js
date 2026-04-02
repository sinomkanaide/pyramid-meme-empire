const express = require('express');
const crypto = require('crypto');
const { adminAuth, generateAdminToken } = require('../middleware/auth');
const db = require('../config/database');
const { calculateLevelFromXp, getXpProgress, applyLevelCap } = require('../models/GameProgress');

const router = express.Router();

// ============================================================================
// AUTO-INIT TABLES (not in schema.sql)
// ============================================================================
async function initAdminTables() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_xp_grants (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        reason TEXT,
        granted_by VARCHAR(42),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_prizes (
        id SERIAL PRIMARY KEY,
        position_from INTEGER NOT NULL,
        position_to INTEGER NOT NULL,
        prize_usdc NUMERIC(10,2) DEFAULT 0,
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    // Ensure quest_bonus columns exist on game_progress
    await db.query(`
      ALTER TABLE game_progress ADD COLUMN IF NOT EXISTS quest_bonus_multiplier DECIMAL(4,2) DEFAULT 1.0
    `).catch(() => {});
    await db.query(`
      ALTER TABLE game_progress ADD COLUMN IF NOT EXISTS quest_bonus_expires_at TIMESTAMP WITH TIME ZONE
    `).catch(() => {});

    // Ensure quest_completions table exists
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

    console.log('[Admin] Admin tables initialized');
  } catch (err) {
    console.error('[Admin] Table init error:', err.message);
  }
}
initAdminTables();

// ============================================================================
// DIAGNOSTIC - DB column check (requires admin auth)
// ============================================================================
router.get('/db-check', adminAuth, async (req, res) => {
  try {
    const tables = ['taps', 'users', 'game_progress', 'transactions', 'quests', 'quest_completions', 'referrals', 'leaderboard_prizes', 'admin_xp_grants'];
    const result = {};
    for (const table of tables) {
      try {
        const cols = await db.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        result[table] = cols.rows.length > 0
          ? cols.rows.map(c => `${c.column_name} (${c.data_type})`)
          : 'TABLE DOES NOT EXIST';
      } catch (err) {
        result[table] = `ERROR: ${err.message}`;
      }
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// AUTH
// ============================================================================

// POST /admin/login
router.post('/login', async (req, res) => {
  try {
    const { wallet_address, password } = req.body;

    if (!wallet_address || !password) {
      return res.status(400).json({ error: 'Wallet address and password required' });
    }

    // Check wallet matches admin wallet
    const adminWallet = process.env.ADMIN_WALLET;
    if (!adminWallet || wallet_address.toLowerCase() !== adminWallet.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized wallet' });
    }

    // Check password (timing-safe comparison)
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(403).json({ error: 'Invalid password' });
    }
    const pwBuffer = Buffer.from(password);
    const adminPwBuffer = Buffer.from(adminPassword);
    if (pwBuffer.length !== adminPwBuffer.length || !crypto.timingSafeEqual(pwBuffer, adminPwBuffer)) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    // Generate admin JWT
    const token = generateAdminToken(wallet_address);

    res.json({
      success: true,
      token,
      wallet: wallet_address
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// All routes below require admin auth
router.use(adminAuth);

// ============================================================================
// ANALYTICS - OVERVIEW
// ============================================================================

// GET /admin/analytics/overview
router.get('/analytics/overview', async (req, res) => {
  const errors = [];

  // 1. Total users
  let totalUsers = 0;
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM users');
    totalUsers = parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[Analytics:Overview] Total users query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'totalUsers', error: err.message });
  }

  // 2. New users today / 7d / 30d
  let newUsers = { today: 0, week: 0, month: 0 };
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as month
      FROM users
    `);
    newUsers = {
      today: parseInt(result.rows[0].today),
      week: parseInt(result.rows[0].week),
      month: parseInt(result.rows[0].month)
    };
  } catch (err) {
    console.error('[Analytics:Overview] New users query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'newUsers', error: err.message });
  }

  // 3. Active users today
  let activeToday = 0;
  try {
    const result = await db.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM taps
      WHERE tapped_at >= CURRENT_DATE
    `);
    activeToday = parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[Analytics:Overview] Active today query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'activeToday', error: err.message });
  }

  // 4. Premium users
  let totalPremium = 0;
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM users
      WHERE is_premium = true AND (premium_expires_at IS NULL OR premium_expires_at > NOW())
    `);
    totalPremium = parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[Analytics:Overview] Premium users query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'totalPremium', error: err.message });
  }

  // 5. Battle Pass users
  let totalBattlePass = 0;
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM users
      WHERE has_battle_pass = true AND (battle_pass_expires_at IS NULL OR battle_pass_expires_at > NOW())
    `);
    totalBattlePass = parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[Analytics:Overview] Battle pass query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'totalBattlePass', error: err.message });
  }

  // 6. Total completed transactions
  let totalTransactions = 0;
  try {
    const result = await db.query(`
      SELECT COUNT(*) as count FROM transactions WHERE status = 'confirmed'
    `);
    totalTransactions = parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[Analytics:Overview] Total transactions query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'totalTransactions', error: err.message });
  }

  // 7. Revenue total
  let revenueTotal = 0;
  try {
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'confirmed'
    `);
    revenueTotal = parseFloat(result.rows[0].total);
  } catch (err) {
    console.error('[Analytics:Overview] Revenue total query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'revenueTotal', error: err.message });
  }

  // 8. Revenue by item
  let revenueByItem = [];
  try {
    const result = await db.query(`
      SELECT type, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
      FROM transactions
      WHERE status = 'confirmed'
      GROUP BY type
      ORDER BY revenue DESC
    `);
    revenueByItem = result.rows.map(r => ({
      item: r.type,
      revenue: parseFloat(r.revenue),
      count: parseInt(r.count)
    }));
  } catch (err) {
    console.error('[Analytics:Overview] Revenue by item query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'revenueByItem', error: err.message });
  }

  // 9. Revenue today / 7d / 30d
  let revenuePeriod = { today: 0, week: 0, month: 0 };
  try {
    const result = await db.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) as today,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'), 0) as week,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as month
      FROM transactions
      WHERE status = 'confirmed'
    `);
    revenuePeriod = {
      today: parseFloat(result.rows[0].today),
      week: parseFloat(result.rows[0].week),
      month: parseFloat(result.rows[0].month)
    };
  } catch (err) {
    console.error('[Analytics:Overview] Revenue period query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'revenuePeriod', error: err.message });
  }

  // Return partial data even if some queries failed
  const response = {
    totalUsers,
    newUsers,
    activeToday,
    totalPremium,
    totalBattlePass,
    totalTransactions,
    revenueTotal,
    revenueByItem,
    revenuePeriod
  };

  if (errors.length > 0) {
    console.error('[Analytics:Overview] Partial failures:', JSON.stringify(errors));
    response._errors = errors;
  }

  res.json(response);
});

// ============================================================================
// ANALYTICS - USERS
// ============================================================================

// GET /admin/analytics/users
router.get('/analytics/users', async (req, res) => {
  const errors = [];

  // 1. New registrations per day (last 30 days)
  let registrationsByDay = [];
  try {
    const result = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    registrationsByDay = result.rows.map(r => ({
      date: r.date,
      count: parseInt(r.count)
    }));
  } catch (err) {
    console.error('[Analytics:Users] Registrations query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'registrationsByDay', error: err.message });
  }

  // 2. Active users per day (last 30 days)
  let activeByDay = [];
  try {
    const result = await db.query(`
      SELECT DATE(tapped_at) as date, COUNT(DISTINCT user_id) as count
      FROM taps
      WHERE tapped_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(tapped_at)
      ORDER BY date ASC
    `);
    activeByDay = result.rows.map(r => ({
      date: r.date,
      count: parseInt(r.count)
    }));
  } catch (err) {
    console.error('[Analytics:Users] Active by day query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'activeByDay', error: err.message });
  }

  // 3. Retention: % of users who come back the next day
  let retentionRate = 0;
  try {
    const result = await db.query(`
      WITH day_users AS (
        SELECT DISTINCT user_id, DATE(tapped_at) as active_date
        FROM taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '14 days'
      )
      SELECT
        CASE WHEN COUNT(DISTINCT d1.user_id) = 0 THEN 0
        ELSE ROUND(
          COUNT(DISTINCT d2.user_id)::numeric / COUNT(DISTINCT d1.user_id) * 100, 1
        ) END as retention_rate
      FROM day_users d1
      LEFT JOIN day_users d2
        ON d1.user_id = d2.user_id
        AND d2.active_date = d1.active_date + 1
      WHERE d1.active_date >= CURRENT_DATE - INTERVAL '14 days'
        AND d1.active_date < CURRENT_DATE
    `);
    retentionRate = parseFloat(result.rows[0]?.retention_rate || 0);
  } catch (err) {
    console.error('[Analytics:Users] Retention query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'retentionRate', error: err.message });
  }

  // 4. Conversion rates
  let conversionRates = { freeToPremium: 0, premiumToBattlePass: 0 };
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_premium = true) as premium,
        COUNT(*) FILTER (WHERE has_battle_pass = true) as battle_pass
      FROM users
    `);
    const total = parseInt(result.rows[0].total) || 1;
    const premiumCount = parseInt(result.rows[0].premium);
    const bpCount = parseInt(result.rows[0].battle_pass);
    conversionRates = {
      freeToPremium: Math.round((premiumCount / total) * 1000) / 10,
      premiumToBattlePass: premiumCount > 0
        ? Math.round((bpCount / premiumCount) * 1000) / 10
        : 0
    };
  } catch (err) {
    console.error('[Analytics:Users] Conversion rates query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'conversionRates', error: err.message });
  }

  // Return partial data even if some queries failed
  const response = {
    registrationsByDay,
    activeByDay,
    retentionRate,
    conversionRates
  };

  if (errors.length > 0) {
    console.error('[Analytics:Users] Partial failures:', JSON.stringify(errors));
    response._errors = errors;
  }

  res.json(response);
});

// ============================================================================
// ANALYTICS - REVENUE
// ============================================================================

// GET /admin/analytics/revenue
router.get('/analytics/revenue', async (req, res) => {
  const errors = [];

  // 1. Revenue per day (last 30 days)
  let revenueByDay = [];
  try {
    const result = await db.query(`
      SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as tx_count
      FROM transactions
      WHERE status = 'confirmed' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    revenueByDay = result.rows.map(r => ({
      date: r.date,
      revenue: parseFloat(r.revenue),
      transactions: parseInt(r.tx_count)
    }));
  } catch (err) {
    console.error('[Analytics:Revenue] Revenue by day query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'revenueByDay', error: err.message });
  }

  // 2. Revenue by item (for pie chart)
  let revenueByItem = [];
  try {
    const result = await db.query(`
      SELECT type, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
      FROM transactions
      WHERE status = 'confirmed'
      GROUP BY type
      ORDER BY revenue DESC
    `);
    revenueByItem = result.rows.map(r => ({
      item: r.type,
      revenue: parseFloat(r.revenue),
      count: parseInt(r.count)
    }));
  } catch (err) {
    console.error('[Analytics:Revenue] Revenue by item query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'revenueByItem', error: err.message });
  }

  // 3. ARPU
  let arpu = 0;
  try {
    const result = await db.query(`
      SELECT
        COALESCE(SUM(t.amount), 0) as total_revenue,
        (SELECT COUNT(*) FROM users) as total_users
      FROM transactions t
      WHERE t.status = 'confirmed'
    `);
    const totalRevenue = parseFloat(result.rows[0].total_revenue);
    const totalUsers = parseInt(result.rows[0].total_users) || 1;
    arpu = Math.round((totalRevenue / totalUsers) * 100) / 100;
  } catch (err) {
    console.error('[Analytics:Revenue] ARPU query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'arpu', error: err.message });
  }

  // 4. Average transaction amount
  let avgTransaction = 0;
  try {
    const result = await db.query(`
      SELECT COALESCE(AVG(amount), 0) as avg_amount
      FROM transactions
      WHERE status = 'confirmed'
    `);
    avgTransaction = Math.round(parseFloat(result.rows[0].avg_amount) * 100) / 100;
  } catch (err) {
    console.error('[Analytics:Revenue] Avg transaction query failed:', err.message, '\nStack:', err.stack);
    errors.push({ metric: 'avgTransaction', error: err.message });
  }

  // Return partial data even if some queries failed
  const response = {
    revenueByDay,
    revenueByItem,
    arpu,
    avgTransaction
  };

  if (errors.length > 0) {
    console.error('[Analytics:Revenue] Partial failures:', JSON.stringify(errors));
    response._errors = errors;
  }

  res.json(response);
});

// ============================================================================
// ANALYTICS - ENGAGEMENT
// ============================================================================

// GET /admin/analytics/engagement
router.get('/analytics/engagement', async (req, res) => {
  const errors = [];

  // 1. Total taps
  let totalTaps = 0;
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM taps');
    totalTaps = parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[Engagement] Total taps query failed:', err.message);
    errors.push({ metric: 'totalTaps', error: err.message });
  }

  // 2. Average taps per user per day (last 7 days)
  let avgTapsPerUserPerDay = 0;
  try {
    const result = await db.query(`
      SELECT ROUND(AVG(daily_taps), 1) as avg_taps FROM (
        SELECT user_id, DATE(tapped_at) as tap_date, COUNT(*) as daily_taps
        FROM taps
        WHERE tapped_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY user_id, DATE(tapped_at)
      ) sub
    `);
    avgTapsPerUserPerDay = parseFloat(result.rows[0]?.avg_taps || 0);
  } catch (err) {
    console.error('[Engagement] Avg taps query failed:', err.message);
    errors.push({ metric: 'avgTapsPerUserPerDay', error: err.message });
  }

  // 3. Level distribution
  let levelDistribution = [];
  try {
    const result = await db.query(`
      SELECT level, COUNT(*) as count
      FROM game_progress
      GROUP BY level
      ORDER BY level ASC
    `);
    levelDistribution = result.rows.map(r => ({
      level: r.level,
      count: parseInt(r.count)
    }));
  } catch (err) {
    console.error('[Engagement] Level distribution query failed:', err.message);
    errors.push({ metric: 'levelDistribution', error: err.message });
  }

  // 4. Quest completions per quest
  let questCompletions = [];
  try {
    // First check if quest_completions table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'quest_completions'
      )
    `);

    if (tableCheck.rows[0].exists) {
      const result = await db.query(`
        SELECT q.title, q.id as quest_id, COUNT(qc.id) as completions
        FROM quests q
        LEFT JOIN quest_completions qc ON qc.quest_id = q.id::text
        WHERE q.is_active = true
        GROUP BY q.id, q.title
        ORDER BY q.sort_order ASC
      `);
      questCompletions = result.rows.map(r => ({
        questId: r.quest_id,
        title: r.title,
        completions: parseInt(r.completions)
      }));
    } else {
      // Table doesn't exist yet - just get quest list without completions
      console.log('[Engagement] quest_completions table does not exist, showing quests with 0 completions');
      const result = await db.query(`
        SELECT title, id as quest_id FROM quests WHERE is_active = true ORDER BY sort_order ASC
      `);
      questCompletions = result.rows.map(r => ({
        questId: r.quest_id,
        title: r.title,
        completions: 0
      }));
    }
  } catch (err) {
    console.error('[Engagement] Quest completions query failed:', err.message, err.stack);
    errors.push({ metric: 'questCompletions', error: err.message });
  }

  // 5. Referral stats
  let referrals = { total: 0, verified: 0, verificationRate: 0 };
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_activated = true) as verified
      FROM referrals
    `);
    const totalReferrals = parseInt(result.rows[0]?.total || 0);
    const verifiedReferrals = parseInt(result.rows[0]?.verified || 0);
    referrals = {
      total: totalReferrals,
      verified: verifiedReferrals,
      verificationRate: totalReferrals > 0
        ? Math.round((verifiedReferrals / totalReferrals) * 1000) / 10
        : 0
    };
  } catch (err) {
    console.error('[Engagement] Referrals query failed:', err.message);
    errors.push({ metric: 'referrals', error: err.message });
  }

  // Return partial data even if some queries failed
  const response = {
    totalTaps,
    avgTapsPerUserPerDay,
    levelDistribution,
    questCompletions,
    referrals
  };

  if (errors.length > 0) {
    console.error('[Engagement] Partial failures:', JSON.stringify(errors));
    response._errors = errors;
  }

  res.json(response);
});

// ============================================================================
// QUEST MANAGEMENT
// ============================================================================

// GET /admin/quests - List all quests with stats
router.get('/quests', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT q.*,
        COUNT(qc.id) as completion_count
      FROM quests q
      LEFT JOIN quest_completions qc ON qc.quest_id = q.id::text
      GROUP BY q.id
      ORDER BY q.sort_order ASC
    `);

    res.json({
      quests: result.rows.map(q => ({
        id: q.id,
        title: q.title,
        description: q.description,
        icon: q.icon,
        quest_type: q.quest_type,
        requirement_type: q.requirement_type,
        requirement_value: q.requirement_value,
        requirement_metadata: q.requirement_metadata,
        reward_type: q.reward_type,
        reward_amount: q.reward_amount ? parseInt(q.reward_amount) : null,
        is_active: q.is_active,
        sort_order: q.sort_order,
        completions: parseInt(q.completion_count) + (parseInt(q.requirement_metadata?.base_completions) || 0),
        created_at: q.created_at
      }))
    });
  } catch (error) {
    console.error('Admin get quests error:', error);
    res.status(500).json({ error: 'Failed to get quests' });
  }
});

// POST /admin/quests - Create new quest
router.post('/quests', async (req, res) => {
  try {
    const { title, description, icon, quest_type, requirement_type, requirement_value, requirement_metadata, reward_amount, external_url, sort_order } = req.body;

    if (!title || !quest_type || !requirement_type) {
      return res.status(400).json({ error: 'title, quest_type, and requirement_type are required' });
    }

    const metadata = requirement_metadata || {};
    if (external_url) metadata.url = external_url;

    const result = await db.query(`
      INSERT INTO quests (title, description, icon, quest_type, requirement_type, requirement_value, requirement_metadata, reward_amount, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      title,
      description || '',
      icon || '🎯',
      quest_type,
      requirement_type,
      requirement_value || 1,
      JSON.stringify(metadata),
      reward_amount ? parseInt(reward_amount) : null,
      sort_order || 99
    ]);

    res.json({ success: true, quest: result.rows[0] });
  } catch (error) {
    console.error('Admin create quest error:', error);
    res.status(500).json({ error: 'Failed to create quest' });
  }
});

// PUT /admin/quests/:id - Edit quest
router.put('/quests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, icon, xp_reward, is_active, external_url, sort_order, partner_api_config, requirement_value } = req.body;

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) { paramCount++; updates.push(`title = $${paramCount}`); values.push(title); }
    if (description !== undefined) { paramCount++; updates.push(`description = $${paramCount}`); values.push(description); }
    if (icon !== undefined) { paramCount++; updates.push(`icon = $${paramCount}`); values.push(icon); }
    if (xp_reward !== undefined) { paramCount++; updates.push(`reward_amount = $${paramCount}`); values.push(xp_reward !== null ? parseInt(xp_reward) : null); }
    if (is_active !== undefined) { paramCount++; updates.push(`is_active = $${paramCount}`); values.push(is_active); }
    if (sort_order !== undefined) { paramCount++; updates.push(`sort_order = $${paramCount}`); values.push(parseInt(sort_order)); }
    if (requirement_value !== undefined) { paramCount++; updates.push(`requirement_value = $${paramCount}`); values.push(parseInt(requirement_value)); }

    // Handle requirement_metadata updates (external_url + partner_api_config)
    // Must be a single SET to avoid PostgreSQL overwriting the same column twice
    if (external_url !== undefined && partner_api_config) {
      partner_api_config.url = external_url;
      paramCount++;
      updates.push(`requirement_metadata = COALESCE(requirement_metadata, '{}') || $${paramCount}::jsonb`);
      values.push(JSON.stringify(partner_api_config));
    } else if (external_url !== undefined) {
      paramCount++;
      updates.push(`requirement_metadata = jsonb_set(COALESCE(requirement_metadata, '{}'), '{url}', $${paramCount}::jsonb)`);
      values.push(JSON.stringify(external_url));
    } else if (partner_api_config) {
      paramCount++;
      updates.push(`requirement_metadata = COALESCE(requirement_metadata, '{}') || $${paramCount}::jsonb`);
      values.push(JSON.stringify(partner_api_config));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = NOW()`);
    values.push(parseInt(id));

    const result = await db.query(
      `UPDATE quests SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    res.json({ success: true, quest: result.rows[0] });
  } catch (error) {
    console.error('Admin update quest error:', error);
    res.status(500).json({ error: 'Failed to update quest' });
  }
});

// PATCH /admin/quests/:id/toggle - Toggle quest active status
router.patch('/quests/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE quests SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, title, is_active`,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    res.json({ success: true, quest: result.rows[0] });
  } catch (error) {
    console.error('Admin toggle quest error:', error);
    res.status(500).json({ error: 'Failed to toggle quest' });
  }
});

// PATCH /admin/quests/:id/reorder - Move quest up or down
router.patch('/quests/:id/reorder', async (req, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body; // 'up' or 'down'

    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Direction must be "up" or "down"' });
    }

    // Get current quest
    const current = await db.query('SELECT id, sort_order FROM quests WHERE id = $1', [parseInt(id)]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const currentOrder = current.rows[0].sort_order || 0;

    // Find the neighbor to swap with
    const neighbor = await db.query(
      direction === 'up'
        ? 'SELECT id, sort_order FROM quests WHERE sort_order < $1 ORDER BY sort_order DESC LIMIT 1'
        : 'SELECT id, sort_order FROM quests WHERE sort_order > $1 ORDER BY sort_order ASC LIMIT 1',
      [currentOrder]
    );

    if (neighbor.rows.length === 0) {
      return res.json({ success: true, message: 'Already at the edge' });
    }

    const neighborId = neighbor.rows[0].id;
    const neighborOrder = neighbor.rows[0].sort_order;

    // Swap sort_orders
    await db.query('UPDATE quests SET sort_order = $1, updated_at = NOW() WHERE id = $2', [neighborOrder, parseInt(id)]);
    await db.query('UPDATE quests SET sort_order = $1, updated_at = NOW() WHERE id = $2', [currentOrder, neighborId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin reorder quest error:', error);
    res.status(500).json({ error: 'Failed to reorder quest' });
  }
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// GET /admin/users - List users with filters and pagination
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const filter = req.query.filter || 'all';
    const search = req.query.search || '';

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      whereClause += ` AND LOWER(u.wallet_address) LIKE $${params.length}`;
    }

    if (filter === 'premium') {
      whereClause += ' AND u.is_premium = true';
    } else if (filter === 'battlepass') {
      whereClause += ' AND u.has_battle_pass = true';
    } else if (filter === 'banned') {
      whereClause += ' AND u.is_banned = true';
    } else if (filter === 'flagged') {
      whereClause += ' AND u.is_flagged = true';
    }

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM users u ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get users with game progress
    const usersResult = await db.query(`
      SELECT u.id, u.wallet_address, u.username, u.is_premium, u.has_battle_pass,
             u.is_banned, u.is_flagged, u.flag_reason, u.created_at, u.referral_code,
             gp.level, gp.bricks, gp.total_taps, gp.energy, gp.pme_tokens
      FROM users u
      LEFT JOIN game_progress gp ON gp.user_id = u.id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    res.json({
      users: usersResult.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// GET /admin/users/:id - User detail
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // User + game progress
    const userResult = await db.query(`
      SELECT u.*, gp.level, gp.bricks, gp.total_taps, gp.energy, gp.max_energy,
             gp.pme_tokens, gp.boost_multiplier, gp.boost_expires_at, gp.boost_type,
             gp.quest_bonus_multiplier, gp.quest_bonus_expires_at,
             gp.total_bricks_earned, gp.last_tap_at
      FROM users u
      LEFT JOIN game_progress gp ON gp.user_id = u.id
      WHERE u.id = $1
    `, [parseInt(id)]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Each sub-query wrapped to avoid full endpoint failure
    let transactions = [];
    try {
      const txResult = await db.query(
        'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
        [parseInt(id)]
      );
      transactions = txResult.rows;
    } catch (err) { console.error('[UserDetail] transactions query failed:', err.message); }

    let completedQuests = [];
    try {
      const questsResult = await db.query(`
        SELECT qc.*, q.title
        FROM quest_completions qc
        LEFT JOIN quests q ON qc.quest_id = q.id::text
        WHERE qc.user_id = $1
        ORDER BY qc.completed_at DESC
      `, [parseInt(id)]);
      completedQuests = questsResult.rows;
    } catch (err) { console.error('[UserDetail] quests query failed:', err.message); }

    let referrals = { total: 0, verified: 0 };
    try {
      const referralsResult = await db.query(`
        SELECT COUNT(*) as total,
               COUNT(*) FILTER (WHERE is_activated = true) as verified
        FROM referrals WHERE referrer_id = $1
      `, [parseInt(id)]);
      referrals = {
        total: parseInt(referralsResult.rows[0]?.total || 0),
        verified: parseInt(referralsResult.rows[0]?.verified || 0)
      };
    } catch (err) { console.error('[UserDetail] referrals query failed:', err.message); }

    let xpGrants = [];
    try {
      const grantsResult = await db.query(
        'SELECT * FROM admin_xp_grants WHERE user_id = $1 ORDER BY created_at DESC',
        [parseInt(id)]
      );
      xpGrants = grantsResult.rows;
    } catch (err) { console.error('[UserDetail] xp_grants query failed:', err.message); }

    res.json({
      user,
      transactions,
      completedQuests,
      referrals,
      xpGrants
    });
  } catch (error) {
    console.error('Admin get user detail error:', error);
    res.status(500).json({ error: 'Failed to get user details' });
  }
});

// POST /admin/users/:id/grant-xp - Grant XP to user
router.post('/users/:id/grant-xp', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { amount, reason } = req.body;

    if (!amount || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ error: 'Amount must be between 1 and 1,000,000' });
    }
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Reason is required' });
    }

    // Get current progress + user info for level cap
    const progressResult = await db.query(
      `SELECT gp.bricks, gp.level, u.is_premium, u.has_battle_pass
       FROM game_progress gp
       JOIN users u ON u.id = gp.user_id
       WHERE gp.user_id = $1`,
      [userId]
    );

    if (progressResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = progressResult.rows[0];
    const currentBricks = row.bricks;
    const newBricks = currentBricks + parseInt(amount);
    const calculatedLevel = calculateLevelFromXp(newBricks);
    const newLevel = applyLevelCap(calculatedLevel, row.is_premium, row.has_battle_pass);
    const xpProgress = getXpProgress(newBricks, newLevel);

    // Update game_progress
    await db.query(
      `UPDATE game_progress SET bricks = $1, level = $2, total_bricks_earned = total_bricks_earned + $3, updated_at = NOW() WHERE user_id = $4`,
      [newBricks, newLevel, parseInt(amount), userId]
    );

    // Log the grant
    await db.query(
      `INSERT INTO admin_xp_grants (user_id, amount, reason, granted_by) VALUES ($1, $2, $3, $4)`,
      [userId, parseInt(amount), reason.trim(), req.admin.walletAddress]
    );

    res.json({
      success: true,
      previousBricks: currentBricks,
      newBricks,
      previousLevel: progressResult.rows[0].level,
      newLevel,
      xpProgress,
      amount: parseInt(amount),
      reason: reason.trim()
    });
  } catch (error) {
    console.error('Admin grant XP error:', error);
    res.status(500).json({ error: 'Failed to grant XP' });
  }
});

// POST /admin/users/:id/grant-premium - Grant premium
router.post('/users/:id/grant-premium', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const result = await db.query(
      `UPDATE users SET is_premium = true, updated_at = NOW() WHERE id = $1 RETURNING id, wallet_address, is_premium`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Admin grant premium error:', error);
    res.status(500).json({ error: 'Failed to grant premium' });
  }
});

// POST /admin/users/:id/grant-battlepass - Grant Battle Pass
router.post('/users/:id/grant-battlepass', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const result = await db.query(
      `UPDATE users SET has_battle_pass = true, battle_pass_expires_at = $1, updated_at = NOW() WHERE id = $2 RETURNING id, wallet_address, has_battle_pass, battle_pass_expires_at`,
      [expiresAt, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Admin grant BP error:', error);
    res.status(500).json({ error: 'Failed to grant battle pass' });
  }
});

// POST /admin/users/:id/ban - Ban user
router.post('/users/:id/ban', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const result = await db.query(
      `UPDATE users SET is_banned = true, updated_at = NOW() WHERE id = $1 RETURNING id, wallet_address, is_banned`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Admin ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// POST /admin/users/:id/unban - Unban user
router.post('/users/:id/unban', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const result = await db.query(
      `UPDATE users SET is_banned = false, updated_at = NOW() WHERE id = $1 RETURNING id, wallet_address, is_banned`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Admin unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ============================================================================
// LEADERBOARD MANAGEMENT
// ============================================================================

// Initialize leaderboard_seasons table
async function initSeasons() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS leaderboard_seasons (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      is_active BOOLEAN DEFAULT false,
      prize_pool_usdc NUMERIC(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
initSeasons().catch(err => console.error('Season table init error:', err));

// GET /admin/leaderboard/seasons - List all seasons
router.get('/leaderboard/seasons', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM leaderboard_seasons ORDER BY starts_at DESC
    `);
    res.json({ seasons: result.rows });
  } catch (error) {
    console.error('Admin get seasons error:', error);
    res.status(500).json({ error: 'Failed to get seasons' });
  }
});

// POST /admin/leaderboard/seasons - Create season
router.post('/leaderboard/seasons', async (req, res) => {
  try {
    const { name, starts_at, ends_at, prize_pool_usdc } = req.body;
    if (!name || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'name, starts_at, ends_at required' });
    }
    const result = await db.query(`
      INSERT INTO leaderboard_seasons (name, starts_at, ends_at, prize_pool_usdc)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [name, starts_at, ends_at, prize_pool_usdc || 0]);
    res.json({ success: true, season: result.rows[0] });
  } catch (error) {
    console.error('Admin create season error:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

// PATCH /admin/leaderboard/seasons/:id/activate - Set active season
router.patch('/leaderboard/seasons/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    // Deactivate all, then activate this one
    await db.query('UPDATE leaderboard_seasons SET is_active = false');
    const result = await db.query(
      'UPDATE leaderboard_seasons SET is_active = true WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Season not found' });
    }
    res.json({ success: true, season: result.rows[0] });
  } catch (error) {
    console.error('Admin activate season error:', error);
    res.status(500).json({ error: 'Failed to activate season' });
  }
});

// PATCH /admin/leaderboard/freeze - Freeze/unfreeze the active season's leaderboard
router.patch('/leaderboard/freeze', async (req, res) => {
  try {
    // Get active season
    const activeResult = await db.query('SELECT * FROM leaderboard_seasons WHERE is_active = true LIMIT 1');
    if (activeResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active season to freeze' });
    }

    const season = activeResult.rows[0];
    const newFrozen = !season.is_frozen;

    if (newFrozen) {
      // Freezing: capture snapshot of current standings
      const playersResult = await db.query(`
        SELECT u.id, u.wallet_address, u.username, u.is_premium, u.has_battle_pass,
               gp.level, gp.bricks, gp.total_taps, gp.total_bricks_earned,
               u.created_at
        FROM users u
        JOIN game_progress gp ON gp.user_id = u.id
        ORDER BY gp.bricks DESC
        LIMIT 200
      `);

      const snapshot = playersResult.rows.map((p, i) => ({
        rank: i + 1,
        id: p.id,
        wallet_address: p.wallet_address,
        username: p.username,
        is_premium: p.is_premium,
        has_battle_pass: p.has_battle_pass,
        level: p.level,
        bricks: p.bricks,
        total_taps: p.total_taps,
        total_bricks_earned: p.total_bricks_earned,
        created_at: p.created_at
      }));

      await db.query(
        'UPDATE leaderboard_seasons SET is_frozen = true, frozen_at = NOW(), frozen_snapshot = $1 WHERE id = $2',
        [JSON.stringify(snapshot), season.id]
      );

      console.log(`[Leaderboard] Season "${season.name}" FROZEN with ${snapshot.length} players snapshot`);
      res.json({ success: true, frozen: true, players_snapshot: snapshot.length, frozen_at: new Date().toISOString() });
    } else {
      // Unfreezing: clear snapshot
      await db.query(
        'UPDATE leaderboard_seasons SET is_frozen = false, frozen_at = NULL, frozen_snapshot = NULL WHERE id = $1',
        [season.id]
      );

      console.log(`[Leaderboard] Season "${season.name}" UNFROZEN`);
      res.json({ success: true, frozen: false });
    }
  } catch (error) {
    console.error('Admin freeze leaderboard error:', error);
    res.status(500).json({ error: 'Failed to freeze leaderboard' });
  }
});

// DELETE /admin/leaderboard/seasons/:id - Delete season
router.delete('/leaderboard/seasons/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM leaderboard_seasons WHERE id = $1 RETURNING id',
      [parseInt(req.params.id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Season not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete season error:', error);
    res.status(500).json({ error: 'Failed to delete season' });
  }
});

// GET /admin/leaderboard - Top players with full data (optionally filtered by season)
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const seasonId = req.query.season_id ? parseInt(req.query.season_id) : null;

    let dateFilter = '';
    const params = [limit];

    if (seasonId) {
      // Get season date range
      const seasonResult = await db.query('SELECT * FROM leaderboard_seasons WHERE id = $1', [seasonId]);
      if (seasonResult.rows.length > 0) {
        const season = seasonResult.rows[0];
        dateFilter = `AND u.created_at >= $2 AND u.created_at <= $3`;
        params.push(season.starts_at, season.ends_at);
      }
    }

    const playersResult = await db.query(`
      SELECT u.id, u.wallet_address, u.username, u.is_premium, u.has_battle_pass,
             gp.level, gp.bricks, gp.total_taps, gp.pme_tokens, gp.total_bricks_earned,
             u.created_at
      FROM users u
      JOIN game_progress gp ON gp.user_id = u.id
      WHERE 1=1 ${dateFilter}
      ORDER BY gp.bricks DESC
      LIMIT $1
    `, params);

    // Get prize structure
    const prizesResult = await db.query(`
      SELECT * FROM leaderboard_prizes ORDER BY position_from ASC
    `);

    // Get active season (include freeze status)
    const activeSeasonResult = await db.query(
      'SELECT id, name, starts_at, ends_at, is_active, prize_pool_usdc, is_frozen, frozen_at, created_at FROM leaderboard_seasons WHERE is_active = true LIMIT 1'
    );

    const activeSeason = activeSeasonResult.rows[0] || null;

    // If frozen and no season filter, use snapshot for display
    let finalPlayers = playersResult.rows.map((p, i) => ({ rank: i + 1, ...p }));
    if (activeSeason?.is_frozen && !seasonId) {
      // Fetch snapshot separately to keep activeSeason response clean
      const snapResult = await db.query('SELECT frozen_snapshot FROM leaderboard_seasons WHERE id = $1', [activeSeason.id]);
      if (snapResult.rows[0]?.frozen_snapshot) {
        finalPlayers = snapResult.rows[0].frozen_snapshot.slice(0, limit);
      }
    }

    res.json({
      players: finalPlayers,
      prizes: prizesResult.rows,
      activeSeason
    });
  } catch (error) {
    console.error('Admin leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// PUT /admin/leaderboard/prizes - Update prize structure
router.put('/leaderboard/prizes', async (req, res) => {
  try {
    const { prizes } = req.body;

    if (!Array.isArray(prizes)) {
      return res.status(400).json({ error: 'prizes must be an array' });
    }

    // Clear existing and insert new
    await db.query('DELETE FROM leaderboard_prizes');

    for (const prize of prizes) {
      await db.query(
        `INSERT INTO leaderboard_prizes (position_from, position_to, prize_usdc, description)
         VALUES ($1, $2, $3, $4)`,
        [prize.position_from, prize.position_to, prize.prize_usdc, prize.description || '']
      );
    }

    // Return updated
    const result = await db.query('SELECT * FROM leaderboard_prizes ORDER BY position_from ASC');

    // Calculate total
    const totalPrizes = result.rows.reduce((sum, p) => {
      const range = p.position_to - p.position_from + 1;
      return sum + (parseFloat(p.prize_usdc) * range);
    }, 0);

    res.json({
      success: true,
      prizes: result.rows,
      totalPrizes: Math.round(totalPrizes * 100) / 100
    });
  } catch (error) {
    console.error('Admin update prizes error:', error);
    res.status(500).json({ error: 'Failed to update prizes' });
  }
});

// ============================================================================
// RECALCULATE ALL USER LEVELS
// ============================================================================

// POST /admin/recalculate-levels - Fix all users with incorrect levels
router.post('/recalculate-levels', async (req, res) => {
  try {
    console.log('[Admin] Recalculating all user levels...');

    const result = await db.query(`
      SELECT gp.user_id, gp.bricks, gp.level as current_level,
             u.is_premium, u.premium_expires_at,
             u.has_battle_pass, u.battle_pass_expires_at
      FROM game_progress gp
      JOIN users u ON u.id = gp.user_id
      ORDER BY gp.user_id
    `);

    let fixed = 0;
    const total = result.rows.length;
    const fixes = [];
    const now = new Date();

    for (const user of result.rows) {
      const totalXp = parseInt(user.bricks) || 0;
      const calculatedLevel = calculateLevelFromXp(totalXp);

      // Check actual premium/BP status including expiration
      const isPremium = user.is_premium && (!user.premium_expires_at || new Date(user.premium_expires_at) > now);
      const hasBattlePass = user.has_battle_pass && (!user.battle_pass_expires_at || new Date(user.battle_pass_expires_at) > now);
      const correctLevel = applyLevelCap(calculatedLevel, isPremium, hasBattlePass);

      if (correctLevel !== user.current_level) {
        await db.query(
          'UPDATE game_progress SET level = $1 WHERE user_id = $2',
          [correctLevel, user.user_id]
        );
        fixes.push({
          userId: user.user_id,
          bricks: totalXp,
          oldLevel: user.current_level,
          newLevel: correctLevel,
          isPremium: user.is_premium,
          hasBattlePass: user.has_battle_pass
        });
        console.log(`[Recalc] User ${user.user_id}: Level ${user.current_level} → ${correctLevel} (${totalXp} bricks)`);
        fixed++;
      }
    }

    console.log(`[Admin] Recalculation complete: ${fixed}/${total} users fixed`);

    res.json({
      success: true,
      total,
      fixed,
      fixes
    });
  } catch (error) {
    console.error('[Admin] Recalculate levels error:', error);
    res.status(500).json({ error: 'Failed to recalculate levels' });
  }
});

// ============================================================================
// ANTI-BOT: AUDIT + FLAG/UNFLAG
// ============================================================================

// GET /admin/leaderboard/export - Bulk audit: all leaderboard players with bot scores
router.get('/leaderboard/export', async (req, res) => {
  try {
    // Check if frozen snapshot exists
    const frozenResult = await db.query(
      'SELECT frozen_snapshot, frozen_at, name FROM leaderboard_seasons WHERE is_active = true AND is_frozen = true LIMIT 1'
    );

    // Get players: frozen snapshot or live
    let playerIds;
    let frozenAt = null;
    let seasonName = null;

    if (frozenResult.rows.length > 0 && frozenResult.rows[0].frozen_snapshot) {
      const snapshot = frozenResult.rows[0].frozen_snapshot;
      playerIds = snapshot.map(p => p.id);
      frozenAt = frozenResult.rows[0].frozen_at;
      seasonName = frozenResult.rows[0].name;
    } else {
      // Live leaderboard
      const liveResult = await db.query(`
        SELECT u.id FROM users u
        JOIN game_progress gp ON gp.user_id = u.id
        ORDER BY gp.bricks DESC LIMIT 200
      `);
      playerIds = liveResult.rows.map(r => r.id);
    }

    if (playerIds.length === 0) {
      return res.json({ players: [], frozenAt, seasonName });
    }

    // Bulk fetch all user data + game progress
    const usersResult = await db.query(`
      SELECT u.id, u.wallet_address, u.username, u.discord_username, u.twitter_username,
             u.is_premium, u.has_battle_pass,
             u.is_flagged, u.flag_reason, u.created_at,
             gp.bricks, gp.level, gp.total_taps, gp.total_bricks_earned
      FROM users u
      LEFT JOIN game_progress gp ON u.id = gp.user_id
      WHERE u.id = ANY($1)
      ORDER BY gp.bricks DESC
    `, [playerIds]);

    // Bulk fetch purchase counts
    const purchaseCounts = {};
    try {
      const pResult = await db.query(`
        SELECT user_id, COUNT(*) as count
        FROM transactions
        WHERE user_id = ANY($1) AND status = 'confirmed'
        GROUP BY user_id
      `, [playerIds]);
      pResult.rows.forEach(r => { purchaseCounts[r.user_id] = parseInt(r.count); });
    } catch (e) { /* ok */ }

    // Bulk fetch peak hour taps (last 24h)
    const peakHours = {};
    try {
      const phResult = await db.query(`
        SELECT user_id, MAX(hourly_count) as peak
        FROM (
          SELECT user_id, date_trunc('hour', tapped_at) as hour, COUNT(*) as hourly_count
          FROM taps
          WHERE user_id = ANY($1) AND tapped_at >= NOW() - INTERVAL '24 hours'
          GROUP BY user_id, date_trunc('hour', tapped_at)
        ) sub
        GROUP BY user_id
      `, [playerIds]);
      phResult.rows.forEach(r => { peakHours[r.user_id] = parseInt(r.peak); });
    } catch (e) { /* ok */ }

    const now = new Date();
    const players = usersResult.rows.map((u, i) => {
      const hoursSinceReg = Math.max(0.1, (now - new Date(u.created_at)) / (1000 * 60 * 60));
      const tapsPerHour = (u.total_taps || 0) / hoursSinceReg;
      const tapsPerMinute = tapsPerHour / 60;
      const hasPurchases = (purchaseCounts[u.id] || 0) > 0;
      const peakHour = peakHours[u.id] || 0;

      // Bot score (same logic as single audit)
      let botScore = 0;
      const flags = [];
      if (tapsPerMinute > 100) { botScore += 30; flags.push('high_tap_rate'); }
      if (tapsPerMinute > 150) { botScore += 30; flags.push('extreme_tap_rate'); }
      if (hoursSinceReg > 5 && tapsPerMinute > 80) { botScore += 25; flags.push('sustained_high_rate'); }
      if (!hasPurchases && tapsPerMinute > 100) { botScore += 15; flags.push('no_purchases'); }
      if (peakHour > 7200) { botScore += 20; flags.push('peak_hour_extreme'); }

      return {
        rank: i + 1,
        wallet: u.wallet_address,
        username: u.username || '',
        discord: u.discord_username || '',
        twitter: u.twitter_username || '',
        level: u.level || 1,
        bricks: u.bricks || 0,
        totalTaps: u.total_taps || 0,
        tapsPerMin: parseFloat(tapsPerMinute.toFixed(1)),
        isPremium: u.is_premium || false,
        hasBattlePass: u.has_battle_pass || false,
        purchases: purchaseCounts[u.id] || 0,
        botScore: Math.min(100, botScore),
        flags,
        isFlagged: u.is_flagged || false,
        flagReason: u.flag_reason || '',
        registeredAt: u.created_at
      };
    });

    res.json({ players, frozenAt, seasonName, total: players.length });
  } catch (error) {
    console.error('[Admin] Leaderboard export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /admin/audit-user - Analyze user for bot behavior
router.post('/audit-user', async (req, res) => {
  try {
    const { walletAddress, userId } = req.body;
    if (!walletAddress && !userId) return res.status(400).json({ error: 'walletAddress or userId required' });

    const userResult = userId
      ? await db.query(`
          SELECT u.*, gp.bricks, gp.level, gp.total_taps, gp.total_bricks_earned
          FROM users u
          LEFT JOIN game_progress gp ON u.id = gp.user_id
          WHERE u.id = $1
        `, [userId])
      : await db.query(`
          SELECT u.*, gp.bricks, gp.level, gp.total_taps, gp.total_bricks_earned
          FROM users u
          LEFT JOIN game_progress gp ON u.id = gp.user_id
          WHERE LOWER(u.wallet_address) = LOWER($1)
        `, [walletAddress]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const registeredAt = new Date(user.created_at);
    const now = new Date();
    const hoursSinceRegistration = Math.max(0.1, (now - registeredAt) / (1000 * 60 * 60));
    const tapsPerHour = (user.total_taps || 0) / hoursSinceRegistration;
    const tapsPerMinute = tapsPerHour / 60;

    // Get tap distribution (taps per hour in last 24h)
    let tapDistribution = [];
    try {
      const distResult = await db.query(`
        SELECT date_trunc('hour', tapped_at) as hour, COUNT(*) as count
        FROM taps
        WHERE user_id = $1 AND tapped_at >= NOW() - INTERVAL '24 hours'
        GROUP BY date_trunc('hour', tapped_at)
        ORDER BY hour DESC
      `, [user.id]);
      tapDistribution = distResult.rows.map(r => ({
        hour: r.hour,
        count: parseInt(r.count)
      }));
    } catch (e) { /* taps table may vary */ }

    // Get purchases
    let purchases = [];
    try {
      const purchasesResult = await db.query(`
        SELECT type, amount, created_at
        FROM transactions
        WHERE user_id = $1 AND status = 'confirmed'
        ORDER BY created_at DESC
      `, [user.id]);
      purchases = purchasesResult.rows;
    } catch (e) { /* ok */ }

    // Calculate bot score (0-100)
    let botScore = 0;
    const suspiciousPatterns = [];

    if (tapsPerMinute > 100) {
      botScore += 30;
      suspiciousPatterns.push(`Sustained ${tapsPerMinute.toFixed(0)} taps/min avg`);
    }
    if (tapsPerMinute > 150) {
      botScore += 30;
      suspiciousPatterns.push('Extremely high tap rate (150+ taps/min)');
    }
    if (hoursSinceRegistration > 5 && tapsPerMinute > 80) {
      botScore += 25;
      suspiciousPatterns.push('Sustained high tap rate for 5+ hours');
    }
    if (purchases.length === 0 && tapsPerMinute > 100) {
      botScore += 15;
      suspiciousPatterns.push('High tap rate with no purchases');
    }

    // Check for sustained activity without breaks
    const peakHour = tapDistribution.reduce((max, h) => h.count > max ? h.count : max, 0);
    if (peakHour > 7200) { // 120 taps/min * 60 min
      botScore += 20;
      suspiciousPatterns.push(`Peak hour: ${peakHour} taps (${Math.round(peakHour / 60)}/min)`);
    }

    res.json({
      wallet: user.wallet_address,
      userId: user.id,
      username: user.username,
      registeredAt: user.created_at,
      hoursSinceRegistration: hoursSinceRegistration.toFixed(1),
      totalTaps: user.total_taps || 0,
      tapsPerHour: Math.round(tapsPerHour),
      tapsPerMinuteAvg: tapsPerMinute.toFixed(1),
      level: user.level || 1,
      bricks: user.bricks || 0,
      isPremium: user.is_premium,
      hasBattlePass: user.has_battle_pass,
      purchases,
      tapDistribution,
      suspiciousPatterns,
      botScore: Math.min(100, botScore),
      isFlagged: user.is_flagged || false,
      flagReason: user.flag_reason || null
    });
  } catch (error) {
    console.error('[Admin] Audit error:', error);
    res.status(500).json({ error: 'Audit failed' });
  }
});

// POST /admin/users/:id/flag - Flag user as suspicious
router.post('/users/:id/flag', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { reason } = req.body;
    const result = await db.query(
      `UPDATE users SET is_flagged = true, flag_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING id, wallet_address, is_flagged, flag_reason`,
      [reason || 'Manually flagged by admin', userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`[Admin] User ${userId} flagged: ${reason || 'manual'}`);
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('[Admin] Flag error:', error);
    res.status(500).json({ error: 'Failed to flag user' });
  }
});

// POST /admin/users/:id/unflag - Remove flag
router.post('/users/:id/unflag', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const result = await db.query(
      `UPDATE users SET is_flagged = false, flag_reason = NULL, updated_at = NOW() WHERE id = $1 RETURNING id, wallet_address, is_flagged`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`[Admin] User ${userId} unflagged`);
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('[Admin] Unflag error:', error);
    res.status(500).json({ error: 'Failed to unflag user' });
  }
});

module.exports = router;

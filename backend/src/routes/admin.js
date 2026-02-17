const express = require('express');
const { adminAuth, generateAdminToken } = require('../middleware/auth');
const db = require('../config/database');
const { calculateLevelFromXp, getXpProgress } = require('../models/GameProgress');

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
// DIAGNOSTIC - DB column check (no auth required)
// ============================================================================
router.get('/db-check', async (req, res) => {
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

    // Check password
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || password !== adminPassword) {
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
  try {
    // Total users
    const totalUsersResult = await db.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // New users today / 7d / 30d
    const newUsersResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as month
      FROM users
    `);
    const newUsers = {
      today: parseInt(newUsersResult.rows[0].today),
      week: parseInt(newUsersResult.rows[0].week),
      month: parseInt(newUsersResult.rows[0].month)
    };

    // Active users today (at least 1 tap today)
    const activeResult = await db.query(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM taps
      WHERE tapped_at >= CURRENT_DATE
    `);
    const activeToday = parseInt(activeResult.rows[0].count);

    // Premium users
    const premiumResult = await db.query(`
      SELECT COUNT(*) as count FROM users
      WHERE is_premium = true AND (premium_expires_at IS NULL OR premium_expires_at > NOW())
    `);
    const totalPremium = parseInt(premiumResult.rows[0].count);

    // Battle Pass users
    const bpResult = await db.query(`
      SELECT COUNT(*) as count FROM users
      WHERE has_battle_pass = true AND (battle_pass_expires_at IS NULL OR battle_pass_expires_at > NOW())
    `);
    const totalBattlePass = parseInt(bpResult.rows[0].count);

    // Total completed transactions
    const txResult = await db.query(`
      SELECT COUNT(*) as count FROM transactions WHERE status = 'confirmed'
    `);
    const totalTransactions = parseInt(txResult.rows[0].count);

    // Revenue total
    const revenueResult = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'confirmed'
    `);
    const revenueTotal = parseFloat(revenueResult.rows[0].total);

    // Revenue by item
    const revenueByItemResult = await db.query(`
      SELECT type, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
      FROM transactions
      WHERE status = 'confirmed'
      GROUP BY type
      ORDER BY revenue DESC
    `);
    const revenueByItem = revenueByItemResult.rows.map(r => ({
      item: r.type,
      revenue: parseFloat(r.revenue),
      count: parseInt(r.count)
    }));

    // Revenue today / 7d / 30d
    const revenuePeriodResult = await db.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE), 0) as today,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'), 0) as week,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as month
      FROM transactions
      WHERE status = 'confirmed'
    `);
    const revenuePeriod = {
      today: parseFloat(revenuePeriodResult.rows[0].today),
      week: parseFloat(revenuePeriodResult.rows[0].week),
      month: parseFloat(revenuePeriodResult.rows[0].month)
    };

    res.json({
      totalUsers,
      newUsers,
      activeToday,
      totalPremium,
      totalBattlePass,
      totalTransactions,
      revenueTotal,
      revenueByItem,
      revenuePeriod
    });
  } catch (error) {
    console.error('Admin analytics overview error:', error);
    res.status(500).json({ error: 'Failed to get analytics overview' });
  }
});

// ============================================================================
// ANALYTICS - USERS
// ============================================================================

// GET /admin/analytics/users
router.get('/analytics/users', async (req, res) => {
  try {
    // New registrations per day (last 30 days)
    const registrationsResult = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Active users per day (last 30 days)
    const activeByDayResult = await db.query(`
      SELECT DATE(tapped_at) as date, COUNT(DISTINCT user_id) as count
      FROM taps
      WHERE tapped_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(tapped_at)
      ORDER BY date ASC
    `);

    // Retention: % of users who come back the next day
    const retentionResult = await db.query(`
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
    const retentionRate = parseFloat(retentionResult.rows[0]?.retention_rate || 0);

    // Conversion rates
    const conversionResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_premium = true) as premium,
        COUNT(*) FILTER (WHERE has_battle_pass = true) as battle_pass
      FROM users
    `);
    const total = parseInt(conversionResult.rows[0].total) || 1;
    const premiumCount = parseInt(conversionResult.rows[0].premium);
    const bpCount = parseInt(conversionResult.rows[0].battle_pass);

    res.json({
      registrationsByDay: registrationsResult.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count)
      })),
      activeByDay: activeByDayResult.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count)
      })),
      retentionRate,
      conversionRates: {
        freeToPremium: Math.round((premiumCount / total) * 1000) / 10,
        premiumToBattlePass: premiumCount > 0
          ? Math.round((bpCount / premiumCount) * 1000) / 10
          : 0
      }
    });
  } catch (error) {
    console.error('Admin analytics users error:', error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

// ============================================================================
// ANALYTICS - REVENUE
// ============================================================================

// GET /admin/analytics/revenue
router.get('/analytics/revenue', async (req, res) => {
  try {
    // Revenue per day (last 30 days)
    const revenueByDayResult = await db.query(`
      SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as tx_count
      FROM transactions
      WHERE status = 'confirmed' AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Revenue by item (for pie chart)
    const revenueByItemResult = await db.query(`
      SELECT type, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
      FROM transactions
      WHERE status = 'confirmed'
      GROUP BY type
      ORDER BY revenue DESC
    `);

    // ARPU
    const arpuResult = await db.query(`
      SELECT
        COALESCE(SUM(t.amount), 0) as total_revenue,
        (SELECT COUNT(*) FROM users) as total_users
      FROM transactions t
      WHERE t.status = 'confirmed'
    `);
    const totalRevenue = parseFloat(arpuResult.rows[0].total_revenue);
    const totalUsers = parseInt(arpuResult.rows[0].total_users) || 1;
    const arpu = Math.round((totalRevenue / totalUsers) * 100) / 100;

    // Average transaction amount
    const avgTxResult = await db.query(`
      SELECT COALESCE(AVG(amount), 0) as avg_amount
      FROM transactions
      WHERE status = 'confirmed'
    `);
    const avgTransaction = Math.round(parseFloat(avgTxResult.rows[0].avg_amount) * 100) / 100;

    res.json({
      revenueByDay: revenueByDayResult.rows.map(r => ({
        date: r.date,
        revenue: parseFloat(r.revenue),
        transactions: parseInt(r.tx_count)
      })),
      revenueByItem: revenueByItemResult.rows.map(r => ({
        item: r.type,
        revenue: parseFloat(r.revenue),
        count: parseInt(r.count)
      })),
      arpu,
      avgTransaction
    });
  } catch (error) {
    console.error('Admin analytics revenue error:', error);
    res.status(500).json({ error: 'Failed to get revenue analytics' });
  }
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
        completions: parseInt(q.completion_count),
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
             u.is_banned, u.created_at, u.referral_code,
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

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Reason is required' });
    }

    // Get current progress
    const progressResult = await db.query(
      'SELECT bricks, level FROM game_progress WHERE user_id = $1',
      [userId]
    );

    if (progressResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentBricks = progressResult.rows[0].bricks;
    const newBricks = currentBricks + parseInt(amount);
    const newLevel = calculateLevelFromXp(newBricks);
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

    // Get active season
    const activeSeasonResult = await db.query(
      'SELECT * FROM leaderboard_seasons WHERE is_active = true LIMIT 1'
    );

    res.json({
      players: playersResult.rows.map((p, i) => ({ rank: i + 1, ...p })),
      prizes: prizesResult.rows,
      activeSeason: activeSeasonResult.rows[0] || null
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

module.exports = router;

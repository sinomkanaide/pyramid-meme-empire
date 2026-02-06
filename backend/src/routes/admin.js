const express = require('express');
const { adminAuth, generateAdminToken } = require('../middleware/auth');
const db = require('../config/database');
const { calculateLevelFromXp, getXpProgress } = require('../models/GameProgress');

const router = express.Router();

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
      WHERE created_at >= CURRENT_DATE
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
      SELECT item_type, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
      FROM transactions
      WHERE status = 'confirmed'
      GROUP BY item_type
      ORDER BY revenue DESC
    `);
    const revenueByItem = revenueByItemResult.rows.map(r => ({
      item: r.item_type,
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
      SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as count
      FROM taps
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Retention: % of users who come back the next day
    const retentionResult = await db.query(`
      WITH day_users AS (
        SELECT DISTINCT user_id, DATE(created_at) as active_date
        FROM taps
        WHERE created_at >= CURRENT_DATE - INTERVAL '14 days'
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
      SELECT item_type, COALESCE(SUM(amount), 0) as revenue, COUNT(*) as count
      FROM transactions
      WHERE status = 'confirmed'
      GROUP BY item_type
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
        item: r.item_type,
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
  try {
    // Total taps
    const totalTapsResult = await db.query('SELECT COUNT(*) as count FROM taps');
    const totalTaps = parseInt(totalTapsResult.rows[0].count);

    // Average taps per user per day (last 7 days)
    const avgTapsResult = await db.query(`
      SELECT ROUND(AVG(daily_taps), 1) as avg_taps FROM (
        SELECT user_id, DATE(created_at) as tap_date, COUNT(*) as daily_taps
        FROM taps
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY user_id, DATE(created_at)
      ) sub
    `);
    const avgTapsPerUserPerDay = parseFloat(avgTapsResult.rows[0]?.avg_taps || 0);

    // Level distribution
    const levelResult = await db.query(`
      SELECT level, COUNT(*) as count
      FROM game_progress
      GROUP BY level
      ORDER BY level ASC
    `);

    // Quest completions per quest
    const questCompletionsResult = await db.query(`
      SELECT q.title, q.id as quest_id, COUNT(qc.id) as completions
      FROM quests q
      LEFT JOIN quest_completions qc ON qc.quest_id = q.id::text
      WHERE q.is_active = true
      GROUP BY q.id, q.title
      ORDER BY q.sort_order ASC
    `);

    // Referral stats
    const referralResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_activated = true) as verified
      FROM referrals
    `);
    const totalReferrals = parseInt(referralResult.rows[0]?.total || 0);
    const verifiedReferrals = parseInt(referralResult.rows[0]?.verified || 0);

    res.json({
      totalTaps,
      avgTapsPerUserPerDay,
      levelDistribution: levelResult.rows.map(r => ({
        level: r.level,
        count: parseInt(r.count)
      })),
      questCompletions: questCompletionsResult.rows.map(r => ({
        questId: r.quest_id,
        title: r.title,
        completions: parseInt(r.completions)
      })),
      referrals: {
        total: totalReferrals,
        verified: verifiedReferrals,
        verificationRate: totalReferrals > 0
          ? Math.round((verifiedReferrals / totalReferrals) * 1000) / 10
          : 0
      }
    });
  } catch (error) {
    console.error('Admin analytics engagement error:', error);
    res.status(500).json({ error: 'Failed to get engagement analytics' });
  }
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
        reward_amount: q.reward_amount,
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
      reward_amount || null,
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
    const { title, description, icon, xp_reward, is_active, external_url, sort_order } = req.body;

    // Build dynamic update
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) { paramCount++; updates.push(`title = $${paramCount}`); values.push(title); }
    if (description !== undefined) { paramCount++; updates.push(`description = $${paramCount}`); values.push(description); }
    if (icon !== undefined) { paramCount++; updates.push(`icon = $${paramCount}`); values.push(icon); }
    if (xp_reward !== undefined) { paramCount++; updates.push(`reward_amount = $${paramCount}`); values.push(xp_reward); }
    if (is_active !== undefined) { paramCount++; updates.push(`is_active = $${paramCount}`); values.push(is_active); }
    if (sort_order !== undefined) { paramCount++; updates.push(`sort_order = $${paramCount}`); values.push(sort_order); }

    if (external_url !== undefined) {
      paramCount++;
      updates.push(`requirement_metadata = jsonb_set(COALESCE(requirement_metadata, '{}'), '{url}', $${paramCount}::jsonb)`);
      values.push(JSON.stringify(external_url));
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

    // Transactions
    const txResult = await db.query(`
      SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
    `, [parseInt(id)]);

    // Completed quests
    const questsResult = await db.query(`
      SELECT qc.*, q.title
      FROM quest_completions qc
      LEFT JOIN quests q ON qc.quest_id = q.id::text
      WHERE qc.user_id = $1
      ORDER BY qc.completed_at DESC
    `, [parseInt(id)]);

    // Referral stats
    const referralsResult = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_activated = true) as verified
      FROM referrals
      WHERE referrer_id = $1
    `, [parseInt(id)]);

    // XP grants history
    const grantsResult = await db.query(`
      SELECT * FROM admin_xp_grants WHERE user_id = $1 ORDER BY created_at DESC
    `, [parseInt(id)]);

    res.json({
      user,
      transactions: txResult.rows,
      completedQuests: questsResult.rows,
      referrals: {
        total: parseInt(referralsResult.rows[0]?.total || 0),
        verified: parseInt(referralsResult.rows[0]?.verified || 0)
      },
      xpGrants: grantsResult.rows
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

// GET /admin/leaderboard - Top players with full data
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(req.query.limit) || 100);

    const playersResult = await db.query(`
      SELECT u.id, u.wallet_address, u.username, u.is_premium, u.has_battle_pass,
             gp.level, gp.bricks, gp.total_taps, gp.pme_tokens, gp.total_bricks_earned,
             u.created_at
      FROM users u
      JOIN game_progress gp ON gp.user_id = u.id
      ORDER BY gp.bricks DESC
      LIMIT $1
    `, [limit]);

    // Get prize structure
    const prizesResult = await db.query(`
      SELECT * FROM leaderboard_prizes ORDER BY position_from ASC
    `);

    res.json({
      players: playersResult.rows.map((p, i) => ({ rank: i + 1, ...p })),
      prizes: prizesResult.rows
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

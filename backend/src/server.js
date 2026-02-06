require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const shopRoutes = require('./routes/shop');
const referralsRoutes = require('./routes/referrals');
const questsRoutes = require('./routes/quests');

// Import Quest model for initialization
const Quest = require('./models/Quest');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'https://pyramid-meme-empire.vercel.app',
    'https://pyramid-meme-empire-git-main-sinomkanaides-projects.vercel.app',
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173'
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  if (req.method === 'POST') {
    console.log('  Content-Type:', req.headers['content-type']);
    console.log('  Body:', JSON.stringify(req.body));
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint to verify body parsing (no auth)
app.post('/api/test-body', (req, res) => {
  console.log('[Test] Body received:', req.body);
  console.log('[Test] Headers:', req.headers);
  res.json({
    received: req.body,
    hasQuestId: !!req.body?.questId,
    questIdType: typeof req.body?.questId,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body || {})
  });
});

// Public endpoint to check quest data format (no auth)
app.get('/api/diagnostics/quests-sample', async (req, res) => {
  try {
    // Get transformed quests directly from Quest model
    const allQuests = await Quest.getAllActive();

    res.json({
      questCount: allQuests.length,
      sampleQuests: allQuests,
      questKeys: allQuests[0] ? Object.keys(allQuests[0]) : [],
      hasQuestId: allQuests[0]?.quest_id ? true : false,
      hasExternalUrl: allQuests[0]?.external_url ? true : false,
      hasXpReward: allQuests[0]?.xp_reward ? true : false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database diagnostics endpoint
app.get('/api/diagnostics/tables', async (req, res) => {
  try {
    const tablesStatus = await Quest.tablesExist();

    // Count quests if table exists
    let questCount = 0;
    if (tablesStatus.quests) {
      const db = require('./config/database');
      const result = await db.query('SELECT COUNT(*) as count FROM quests');
      questCount = parseInt(result.rows[0].count);
    }

    res.json({
      status: 'ok',
      tables: tablesStatus,
      questCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Diagnostics error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Manual table initialization endpoint (for debugging)
app.post('/api/diagnostics/init-quests', async (req, res) => {
  try {
    console.log('Manual quest table initialization requested');
    await Quest.initializeTables();
    const tablesStatus = await Quest.tablesExist();

    res.json({
      status: 'ok',
      message: 'Quest tables initialized',
      tables: tablesStatus
    });
  } catch (error) {
    console.error('Manual initialization error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/quests', questsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Run safe migrations for new columns
const runMigrations = async () => {
  const db = require('./config/database');
  const migrations = [
    'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 8453',
    'ALTER TABLE transactions ADD COLUMN IF NOT EXISTS block_number BIGINT',
    'ALTER TABLE game_progress ADD COLUMN IF NOT EXISTS quest_bonus_multiplier DECIMAL(4,2) DEFAULT 1.0',
    'ALTER TABLE game_progress ADD COLUMN IF NOT EXISTS quest_bonus_expires_at TIMESTAMP WITH TIME ZONE',
    `INSERT INTO quests (title, description, icon, quest_type, requirement_type, requirement_value, requirement_metadata, reward_type, is_reward_hidden, sort_order)
     SELECT 'KiiChain Testnet', 'Interact with KiiChain testnet to earn a +20% Tap Bonus for 30 days!', '⚡', 'partner', 'partner_quest', 1, '{"url": "https://app.testnet.kiichain.io/kiichain"}', 'boost', TRUE, 9
     WHERE NOT EXISTS (SELECT 1 FROM quests WHERE requirement_type = 'partner_quest')`,
  ];

  for (const sql of migrations) {
    try {
      await db.query(sql);
    } catch (err) {
      console.log('[Migration] Skipped:', err.message);
    }
  }
  console.log('[Migration] Table columns verified');
};

// Initialize database tables and start server
const startServer = async () => {
  // Run safe migrations
  try {
    await runMigrations();
  } catch (err) {
    console.error('[Migration] Error:', err.message);
  }

  // Check if tables exist first
  try {
    const tablesStatus = await Quest.tablesExist();
    console.log('Quest tables status:', tablesStatus);

    if (!tablesStatus.quests || !tablesStatus.quest_completions) {
      console.log('Quest tables missing, initializing...');
      await Quest.initializeTables();
      console.log('Quest tables initialized successfully');
    } else {
      console.log('Quest tables already exist, skipping initialization');
      // Verify quests are seeded
      const db = require('./config/database');
      const result = await db.query('SELECT COUNT(*) as count FROM quests');
      const questCount = parseInt(result.rows[0].count);
      console.log(`Found ${questCount} quests in database`);

      if (questCount === 0) {
        console.log('No quests found, re-seeding...');
        await Quest.initializeTables();
      }
    }
  } catch (error) {
    console.error('Failed to initialize quest tables:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    // Continue anyway - we'll try to initialize on first request
  }

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🗿 PYRAMID MEME EMPIRE BACKEND 🗿               ║
║                                                   ║
║   Server running on port ${PORT}                    ║
║   Environment: ${process.env.NODE_ENV || 'development'}                  ║
║                                                   ║
║   Endpoints:                                      ║
║   - GET  /health                                  ║
║   - POST /api/auth/verify                         ║
║   - GET  /api/auth/me                             ║
║   - GET  /api/game/progress                       ║
║   - POST /api/game/tap                            ║
║   - POST /api/game/claim                          ║
║   - GET  /api/game/leaderboard                    ║
║   - GET  /api/shop/items                          ║
║   - POST /api/shop/purchase                       ║
║   - GET  /api/referrals/stats                     ║
║   - GET  /api/referrals/list                      ║
║   - GET  /api/referrals/code                      ║
║   - GET  /api/quests                              ║
║   - POST /api/quests/complete                     ║
║   - GET  /api/quests/progress/:id                 ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
  });
};

startServer();

module.exports = app;

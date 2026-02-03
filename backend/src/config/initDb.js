const { pool } = require('./database');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const initDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log('🏛️  PYRAMID MEME EMPIRE - Database Initialization');
    console.log('================================================\n');

    // Read the schema SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');

    if (fs.existsSync(schemaPath)) {
      console.log('📄 Reading schema.sql file...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      console.log('🔧 Executing schema...\n');
      await client.query(schemaSql);

      console.log('✅ Full schema executed successfully!\n');
    } else {
      // Fallback to inline schema if file doesn't exist
      console.log('⚠️  schema.sql not found, using inline schema...\n');
      await createInlineSchema(client);
    }

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('📊 Tables created:');
    tablesResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });

    // Verify views were created
    const viewsResult = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    if (viewsResult.rows.length > 0) {
      console.log('\n📈 Views created:');
      viewsResult.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.table_name}`);
      });
    }

    // Count shop items
    const shopCount = await client.query('SELECT COUNT(*) FROM shop_items');
    console.log(`\n🛒 Shop items: ${shopCount.rows[0].count}`);

    // Count quests
    const questCount = await client.query('SELECT COUNT(*) FROM quests');
    console.log(`🎯 Quests: ${questCount.rows[0].count}`);

    console.log('\n================================================');
    console.log('🎉 DATABASE INITIALIZED SUCCESSFULLY!');
    console.log('================================================\n');

  } catch (error) {
    console.error('\n❌ Error initializing database:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Fallback inline schema (minimal version)
const createInlineSchema = async (client) => {
  // Users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(42) UNIQUE NOT NULL,
      username VARCHAR(50),
      is_premium BOOLEAN DEFAULT FALSE,
      premium_expires_at TIMESTAMP WITH TIME ZONE,
      has_battle_pass BOOLEAN DEFAULT FALSE,
      battle_pass_expires_at TIMESTAMP WITH TIME ZONE,
      referral_code VARCHAR(20) UNIQUE NOT NULL,
      referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      referral_bonus_percent DECIMAL(5, 2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Users table created');

  // Game Progress table
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bricks INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      pme_tokens DECIMAL(18, 8) DEFAULT 0,
      energy INTEGER DEFAULT 100,
      max_energy INTEGER DEFAULT 100,
      tap_power INTEGER DEFAULT 1,
      total_taps BIGINT DEFAULT 0,
      last_tap_at TIMESTAMP WITH TIME ZONE,
      boost_multiplier DECIMAL(4, 2) DEFAULT 1.0,
      boost_expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Game Progress table created');

  // Transactions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tx_hash VARCHAR(66) UNIQUE NOT NULL,
      type VARCHAR(30) NOT NULL,
      amount DECIMAL(18, 6) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USDC',
      status VARCHAR(20) DEFAULT 'pending',
      item_purchased VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      confirmed_at TIMESTAMP WITH TIME ZONE
    );
  `);
  console.log('✅ Transactions table created');

  // Referrals table
  await client.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id SERIAL PRIMARY KEY,
      referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_activated BOOLEAN DEFAULT FALSE,
      bonus_claimed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      activated_at TIMESTAMP WITH TIME ZONE
    );
  `);
  console.log('✅ Referrals table created');

  // Quests table
  await client.query(`
    CREATE TABLE IF NOT EXISTS quests (
      id SERIAL PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      icon VARCHAR(50),
      quest_type VARCHAR(30) NOT NULL,
      requirement_type VARCHAR(50) NOT NULL,
      requirement_value INTEGER DEFAULT 1,
      reward_type VARCHAR(30) DEFAULT 'pme',
      is_reward_hidden BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Quests table created');

  // Quest Progress table
  await client.query(`
    CREATE TABLE IF NOT EXISTS quest_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
      current_progress INTEGER DEFAULT 0,
      is_completed BOOLEAN DEFAULT FALSE,
      reward_claimed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP WITH TIME ZONE,
      UNIQUE(user_id, quest_id)
    );
  `);
  console.log('✅ Quest Progress table created');

  // Shop Items table
  await client.query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      slug VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      price_usdc DECIMAL(10, 2) NOT NULL,
      item_type VARCHAR(30) NOT NULL,
      duration_hours INTEGER,
      multiplier DECIMAL(4, 2),
      energy_amount INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      is_featured BOOLEAN DEFAULT FALSE,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('✅ Shop Items table created');

  // Indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(LOWER(wallet_address));
    CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
    CREATE INDEX IF NOT EXISTS idx_game_progress_bricks ON game_progress(bricks DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
  `);
  console.log('✅ Indexes created');

  // Seed shop items
  await client.query(`
    INSERT INTO shop_items (name, slug, description, icon, price_usdc, item_type, duration_hours, multiplier, energy_amount, is_featured, sort_order)
    VALUES
      ('Battle Pass', 'battle_pass', 'Season 1 - All boosts included', '👑', 5.00, 'subscription', 720, NULL, NULL, TRUE, 1),
      ('Premium', 'premium', 'Unlimited energy forever', '👑', 2.00, 'subscription', NULL, NULL, NULL, FALSE, 2),
      ('Boost X2', 'boost_x2', '2X bricks for 24h', '⚡', 0.50, 'boost', 24, 2.0, NULL, FALSE, 3),
      ('Boost X5', 'boost_x5', '5X bricks for 24h', '🔥', 1.50, 'boost', 24, 5.0, NULL, FALSE, 4),
      ('Energy Refill', 'energy_refill', '+100 energy', '🔋', 0.25, 'consumable', NULL, NULL, 100, FALSE, 5)
    ON CONFLICT (slug) DO NOTHING;
  `);
  console.log('✅ Shop items seeded');

  // Seed quests
  await client.query(`
    INSERT INTO quests (title, description, icon, quest_type, requirement_type, requirement_value, sort_order)
    VALUES
      ('Follow on X', 'Follow @PyramidMeme on X', '🐦', 'social', 'twitter_follow', 1, 1),
      ('Like Latest Post', 'Like our pinned post', '❤️', 'social', 'twitter_like', 1, 2),
      ('Retweet', 'RT our announcement', '🔄', 'social', 'twitter_retweet', 1, 3),
      ('Join Telegram', 'Join our community', '💬', 'social', 'telegram_join', 1, 4),
      ('Stack 100 Bricks', 'Tap 100 times', '🧱', 'game', 'tap_count', 100, 5)
    ON CONFLICT DO NOTHING;
  `);
  console.log('✅ Quests seeded');
};

// Run initialization
initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

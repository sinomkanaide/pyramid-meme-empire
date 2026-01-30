const { pool } = require('./database');
require('dotenv').config();

const initDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log('Initializing database...');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        username VARCHAR(50),
        is_premium BOOLEAN DEFAULT FALSE,
        premium_expires_at TIMESTAMP,
        referral_code VARCHAR(20) UNIQUE,
        referred_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');

    // Game Progress table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        bricks INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        pme_tokens DECIMAL(18, 8) DEFAULT 0,
        energy INTEGER DEFAULT 100,
        last_tap_at TIMESTAMP,
        total_taps INTEGER DEFAULT 0,
        boost_multiplier DECIMAL(3, 1) DEFAULT 1.0,
        boost_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );
    `);
    console.log('✅ Game Progress table created');

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tx_hash VARCHAR(66) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(18, 6) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USDC',
        status VARCHAR(20) DEFAULT 'pending',
        item_purchased VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP
      );
    `);
    console.log('✅ Transactions table created');

    // Referrals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referred_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        is_activated BOOLEAN DEFAULT FALSE,
        bonus_claimed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP,
        UNIQUE(referred_id)
      );
    `);
    console.log('✅ Referrals table created');

    // Quests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS quest_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        quest_id INTEGER NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        reward_claimed BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, quest_id)
      );
    `);
    console.log('✅ Quest Progress table created');

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
      CREATE INDEX IF NOT EXISTS idx_game_bricks ON game_progress(bricks DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    `);
    console.log('✅ Indexes created');

    console.log('\n🎉 Database initialized successfully!');

  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initDatabase().catch(console.error);

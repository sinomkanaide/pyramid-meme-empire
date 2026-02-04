/**
 * Database Verification Script
 * Checks that all required tables exist and are properly configured
 * Run: node src/config/verifyDb.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const REQUIRED_TABLES = [
  'users',
  'game_progress',
  'taps',
  'transactions',
  'shop_items',
  'referrals',
  'quests',
  'quest_progress',
  'leaderboard_snapshots',
  'user_sessions',
  'battle_pass_rewards',
  'user_battle_pass'
];

const REQUIRED_VIEWS = [
  'leaderboard',
  'user_stats'
];

async function verifyDatabase() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║     PYRAMID MEME EMPIRE - Database Verification   ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!\n');

    // Check tables
    console.log('📋 Checking required tables...');
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const existingTables = tablesResult.rows.map(r => r.table_name);
    let missingTables = [];

    for (const table of REQUIRED_TABLES) {
      if (existingTables.includes(table)) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} (MISSING)`);
        missingTables.push(table);
      }
    }

    // Check views
    console.log('\n📊 Checking required views...');
    const viewsResult = await pool.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const existingViews = viewsResult.rows.map(r => r.table_name);
    let missingViews = [];

    for (const view of REQUIRED_VIEWS) {
      if (existingViews.includes(view)) {
        console.log(`   ✅ ${view}`);
      } else {
        console.log(`   ❌ ${view} (MISSING)`);
        missingViews.push(view);
      }
    }

    // Check row counts
    console.log('\n📈 Table statistics...');

    if (existingTables.includes('users')) {
      const usersCount = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`   👥 Users: ${usersCount.rows[0].count}`);
    }

    if (existingTables.includes('game_progress')) {
      const progressCount = await pool.query('SELECT COUNT(*) FROM game_progress');
      console.log(`   🎮 Game Progress: ${progressCount.rows[0].count}`);
    }

    if (existingTables.includes('taps')) {
      const tapsCount = await pool.query('SELECT COUNT(*) FROM taps');
      console.log(`   👆 Taps logged: ${tapsCount.rows[0].count}`);
    }

    if (existingTables.includes('shop_items')) {
      const itemsCount = await pool.query('SELECT COUNT(*) FROM shop_items');
      console.log(`   🛒 Shop items: ${itemsCount.rows[0].count}`);
    }

    if (existingTables.includes('quests')) {
      const questsCount = await pool.query('SELECT COUNT(*) FROM quests');
      console.log(`   🎯 Quests: ${questsCount.rows[0].count}`);
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');

    if (missingTables.length === 0 && missingViews.length === 0) {
      console.log('✅ DATABASE VERIFICATION PASSED!');
      console.log('   All required tables and views exist.');
    } else {
      console.log('⚠️  DATABASE VERIFICATION FAILED!');
      if (missingTables.length > 0) {
        console.log(`   Missing tables: ${missingTables.join(', ')}`);
      }
      if (missingViews.length > 0) {
        console.log(`   Missing views: ${missingViews.join(', ')}`);
      }
      console.log('\n   Run: npm run db:init to create missing tables');
    }
    console.log('═══════════════════════════════════════════════════\n');

    return missingTables.length === 0 && missingViews.length === 0;

  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure DATABASE_URL is set correctly in .env');
    }
    return false;
  } finally {
    await pool.end();
  }
}

// Run verification
verifyDatabase()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

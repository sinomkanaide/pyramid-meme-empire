-- ============================================================================
-- PYRAMID MEME EMPIRE - DATABASE SCHEMA v1.0
-- PostgreSQL Database Schema
-- ============================================================================

-- Enable UUID extension for better IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE
-- Stores wallet addresses, profile info, and premium status
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    username VARCHAR(50),
    avatar_url TEXT,

    -- Premium/Subscription Status
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMP WITH TIME ZONE,
    has_battle_pass BOOLEAN DEFAULT FALSE,
    battle_pass_expires_at TIMESTAMP WITH TIME ZONE,
    battle_pass_season INTEGER DEFAULT 0,

    -- Referral System
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    referral_bonus_percent DECIMAL(5, 2) DEFAULT 0,

    -- Account Status
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. GAME PROGRESS TABLE
-- Stores the main game state for each user
-- ============================================================================
CREATE TABLE IF NOT EXISTS game_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Core Game Stats
    bricks INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_to_next_level INTEGER DEFAULT 100,

    -- Token/Currency
    pme_tokens DECIMAL(18, 8) DEFAULT 0,
    pme_claimed DECIMAL(18, 8) DEFAULT 0,

    -- Energy System
    energy INTEGER DEFAULT 100,
    max_energy INTEGER DEFAULT 100,
    energy_regen_rate INTEGER DEFAULT 1, -- per 30 seconds
    last_energy_update TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Tap Mechanics
    tap_power INTEGER DEFAULT 1,
    total_taps BIGINT DEFAULT 0,
    total_bricks_earned BIGINT DEFAULT 0,
    last_tap_at TIMESTAMP WITH TIME ZONE,

    -- Active Boosts
    boost_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    boost_expires_at TIMESTAMP WITH TIME ZONE,
    boost_type VARCHAR(20), -- 'x2', 'x5', etc.

    -- XP Bonus (from Battle Pass)
    xp_bonus_percent DECIMAL(5, 2) DEFAULT 0,

    -- Streak System
    daily_streak INTEGER DEFAULT 0,
    last_daily_claim TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. TAPS TABLE
-- Detailed log of each tap (for analytics and anti-cheat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS taps (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Tap Details
    bricks_earned INTEGER NOT NULL DEFAULT 1,
    multiplier DECIMAL(4, 2) DEFAULT 1.0,
    energy_used INTEGER DEFAULT 1,

    -- Context
    session_id UUID,
    ip_address INET,
    user_agent TEXT,

    -- Anti-Cheat
    is_valid BOOLEAN DEFAULT TRUE,
    validation_flags JSONB DEFAULT '{}',

    -- Timestamp
    tapped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Partition taps by month for performance (optional - can be implemented later)
-- CREATE TABLE taps_y2025m01 PARTITION OF taps FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ============================================================================
-- 4. TRANSACTIONS TABLE
-- All financial transactions (USDC purchases)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Blockchain Data
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    block_number BIGINT,
    from_address VARCHAR(42),
    to_address VARCHAR(42),

    -- Transaction Details
    type VARCHAR(30) NOT NULL, -- 'premium', 'battle_pass', 'boost_x2', 'boost_x5', 'energy_refill'
    amount DECIMAL(18, 6) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USDC',

    -- Item Purchased
    item_id INTEGER,
    item_name VARCHAR(50),
    item_metadata JSONB DEFAULT '{}',

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'failed', 'refunded'
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. SHOP ITEMS TABLE
-- Available items in the shop
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,

    -- Item Info
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL, -- 'premium', 'battle_pass', 'boost_x2', etc.
    description TEXT,
    icon VARCHAR(50), -- emoji or icon name

    -- Pricing
    price_usdc DECIMAL(10, 2) NOT NULL,
    original_price DECIMAL(10, 2), -- for showing discounts

    -- Item Type & Effects
    item_type VARCHAR(30) NOT NULL, -- 'subscription', 'boost', 'consumable'
    duration_hours INTEGER, -- for time-limited items (NULL = permanent)
    multiplier DECIMAL(4, 2), -- for boosts
    energy_amount INTEGER, -- for energy refills

    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,

    -- Limits
    max_purchases_per_user INTEGER, -- NULL = unlimited
    available_from TIMESTAMP WITH TIME ZONE,
    available_until TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. REFERRALS TABLE
-- Tracks referral relationships and bonuses
-- ============================================================================
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Referral Status
    is_activated BOOLEAN DEFAULT FALSE, -- TRUE when referred user makes first purchase
    activation_type VARCHAR(30), -- 'premium', 'battle_pass', etc.

    -- Bonuses
    bonus_percent DECIMAL(5, 2) DEFAULT 10.0, -- 10% per activated referral
    bonus_claimed BOOLEAN DEFAULT FALSE,
    bonus_amount DECIMAL(18, 8) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP WITH TIME ZONE,
    bonus_claimed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 7. QUESTS TABLE
-- Quest definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS quests (
    id SERIAL PRIMARY KEY,

    -- Quest Info
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50),

    -- Quest Type & Requirements
    quest_type VARCHAR(30) NOT NULL, -- 'social', 'game', 'daily', 'weekly', 'achievement'
    requirement_type VARCHAR(50) NOT NULL, -- 'twitter_follow', 'telegram_join', 'tap_count', etc.
    requirement_value INTEGER DEFAULT 1, -- e.g., tap 100 times
    requirement_metadata JSONB DEFAULT '{}', -- e.g., {"twitter_handle": "@pyramidmeme"}

    -- Rewards
    reward_type VARCHAR(30) DEFAULT 'pme', -- 'pme', 'energy', 'boost', 'xp'
    reward_amount DECIMAL(18, 8),
    reward_metadata JSONB DEFAULT '{}',
    is_reward_hidden BOOLEAN DEFAULT TRUE, -- Show as "TBA" until claimed

    -- Availability
    is_active BOOLEAN DEFAULT TRUE,
    is_repeatable BOOLEAN DEFAULT FALSE,
    reset_period VARCHAR(20), -- 'daily', 'weekly', NULL for one-time
    sort_order INTEGER DEFAULT 0,

    -- Time Limits
    available_from TIMESTAMP WITH TIME ZONE,
    available_until TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. QUEST PROGRESS TABLE
-- User progress on quests
-- ============================================================================
CREATE TABLE IF NOT EXISTS quest_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,

    -- Progress
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,

    -- Rewards
    reward_claimed BOOLEAN DEFAULT FALSE,
    reward_amount_received DECIMAL(18, 8),

    -- Verification (for social quests)
    verification_data JSONB DEFAULT '{}',
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    claimed_at TIMESTAMP WITH TIME ZONE,

    -- For repeatable quests
    reset_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE,

    -- Unique constraint per user per quest
    UNIQUE(user_id, quest_id)
);

-- ============================================================================
-- 9. LEADERBOARD SNAPSHOTS TABLE
-- Periodic snapshots of the leaderboard for historical data
-- ============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id SERIAL PRIMARY KEY,

    -- Snapshot Period
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'season'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Rankings (stored as JSONB array)
    rankings JSONB NOT NULL, -- [{rank, user_id, wallet_address, username, bricks, level, reward}]

    -- Stats
    total_participants INTEGER,
    total_bricks BIGINT,

    -- Rewards Distribution
    rewards_distributed BOOLEAN DEFAULT FALSE,
    total_rewards DECIMAL(18, 8),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint per period
    UNIQUE(period_type, period_start)
);

-- ============================================================================
-- 10. USER SESSIONS TABLE
-- Track user sessions for analytics and security
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Session Info
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 11. BATTLE PASS REWARDS TABLE
-- Defines rewards for each battle pass level
-- ============================================================================
CREATE TABLE IF NOT EXISTS battle_pass_rewards (
    id SERIAL PRIMARY KEY,
    season INTEGER NOT NULL,
    level INTEGER NOT NULL,

    -- Reward Info
    reward_type VARCHAR(30) NOT NULL, -- 'pme', 'boost', 'nft', 'cosmetic', 'xp'
    reward_name VARCHAR(100),
    reward_description TEXT,
    reward_amount DECIMAL(18, 8),
    reward_metadata JSONB DEFAULT '{}',

    -- Premium Only?
    is_premium_only BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint
    UNIQUE(season, level, reward_type)
);

-- ============================================================================
-- 12. USER BATTLE PASS PROGRESS
-- Track user progress in battle pass
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_battle_pass (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,

    -- Progress
    current_level INTEGER DEFAULT 1,
    current_xp INTEGER DEFAULT 0,

    -- Claimed Rewards (array of reward IDs)
    claimed_rewards INTEGER[] DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint
    UNIQUE(user_id, season)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(LOWER(wallet_address));
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Game Progress indexes
CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_game_progress_bricks ON game_progress(bricks DESC);
CREATE INDEX IF NOT EXISTS idx_game_progress_level ON game_progress(level DESC);
CREATE INDEX IF NOT EXISTS idx_game_progress_leaderboard ON game_progress(bricks DESC, level DESC);

-- Taps indexes
CREATE INDEX IF NOT EXISTS idx_taps_user_id ON taps(user_id);
CREATE INDEX IF NOT EXISTS idx_taps_tapped_at ON taps(tapped_at);
CREATE INDEX IF NOT EXISTS idx_taps_user_time ON taps(user_id, tapped_at DESC);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Referrals indexes
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_activated ON referrals(referrer_id, is_activated);

-- Quest Progress indexes
CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON quest_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_quest ON quest_progress(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_progress_completed ON quest_progress(user_id, is_completed);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(user_id, is_active);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Real-time Leaderboard View
CREATE OR REPLACE VIEW leaderboard AS
SELECT
    ROW_NUMBER() OVER (ORDER BY gp.bricks DESC, gp.level DESC, u.created_at ASC) as rank,
    u.id as user_id,
    u.wallet_address,
    u.username,
    u.is_premium,
    u.has_battle_pass,
    gp.bricks,
    gp.level,
    gp.total_taps,
    gp.pme_tokens
FROM users u
JOIN game_progress gp ON u.id = gp.user_id
WHERE u.is_active = TRUE AND u.is_banned = FALSE
ORDER BY gp.bricks DESC, gp.level DESC, u.created_at ASC;

-- User Stats View
CREATE OR REPLACE VIEW user_stats AS
SELECT
    u.id as user_id,
    u.wallet_address,
    u.username,
    u.is_premium,
    u.has_battle_pass,
    u.referral_code,
    gp.bricks,
    gp.level,
    gp.energy,
    gp.max_energy,
    gp.total_taps,
    gp.pme_tokens,
    gp.boost_multiplier,
    gp.boost_expires_at,
    (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id) as total_referrals,
    (SELECT COUNT(*) FROM referrals r WHERE r.referrer_id = u.id AND r.is_activated = TRUE) as activated_referrals,
    (SELECT rank FROM leaderboard l WHERE l.user_id = u.id) as global_rank
FROM users u
JOIN game_progress gp ON u.id = gp.user_id;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at for users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for game_progress
DROP TRIGGER IF EXISTS update_game_progress_updated_at ON game_progress;
CREATE TRIGGER update_game_progress_updated_at
    BEFORE UPDATE ON game_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for transactions
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA - SHOP ITEMS
-- ============================================================================

INSERT INTO shop_items (name, slug, description, icon, price_usdc, item_type, duration_hours, multiplier, energy_amount, is_active, is_featured, sort_order)
VALUES
    ('Battle Pass', 'battle_pass', 'Season 1 - All boosts, NFT reward, +10% XP, unlimited energy', '👑', 5.00, 'subscription', 720, NULL, NULL, TRUE, TRUE, 1),
    ('Premium', 'premium', 'Unlimited energy and no cooldown - forever!', '👑', 2.00, 'subscription', NULL, NULL, NULL, TRUE, FALSE, 2),
    ('Boost X2', 'boost_x2', 'Double your brick gains for 24 hours', '⚡', 0.50, 'boost', 24, 2.0, NULL, TRUE, FALSE, 3),
    ('Boost X5', 'boost_x5', '5X brick multiplier for 24 hours', '🔥', 1.50, 'boost', 24, 5.0, NULL, TRUE, FALSE, 4),
    ('Energy Refill', 'energy_refill', 'Instantly restore +100 energy', '🔋', 0.25, 'consumable', NULL, NULL, 100, TRUE, FALSE, 5)
ON CONFLICT (slug) DO UPDATE SET
    price_usdc = EXCLUDED.price_usdc,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEED DATA - QUESTS
-- ============================================================================

INSERT INTO quests (title, description, icon, quest_type, requirement_type, requirement_value, requirement_metadata, reward_type, is_reward_hidden, sort_order)
VALUES
    ('Follow on X', 'Follow @tapkamunfun on X', '🐦', 'social', 'twitter_follow', 1, '{"handle": "@tapkamunfun", "url": "https://x.com/tapkamunfun"}', 'pme', TRUE, 1),
    ('Like Latest Post', 'Like our pinned post on X', '❤️', 'social', 'twitter_like', 1, '{"url": "https://x.com/tapkamunfun"}', 'pme', TRUE, 2),
    ('Retweet', 'RT our announcement', '🔄', 'social', 'twitter_retweet', 1, '{"url": "https://x.com/tapkamunfun"}', 'pme', TRUE, 3),
    ('Join Telegram', 'Join our community on Telegram', '💬', 'social', 'telegram_join', 1, '{"url": "https://t.me/tapkamun"}', 'pme', TRUE, 4),
    ('Join Discord', 'Join our Discord server', '🎮', 'social', 'discord_join', 1, '{"url": "https://discord.gg/Ygn5DXtAze"}', 'pme', TRUE, 5),
    ('Stack 100 Bricks', 'Tap 100 times to earn bricks', '🧱', 'game', 'tap_count', 100, '{}', 'pme', TRUE, 6),
    ('Stack 1000 Bricks', 'Tap 1000 times - Brick Master!', '🏆', 'achievement', 'tap_count', 1000, '{}', 'pme', TRUE, 7),
    ('Invite a Friend', 'Get someone to join using your referral link', '👥', 'social', 'referral', 1, '{}', 'pme', TRUE, 8),
    ('First Purchase', 'Make your first purchase in the shop', '💎', 'game', 'purchase', 1, '{}', 'pme', TRUE, 9)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Stores user accounts linked to wallet addresses';
COMMENT ON TABLE game_progress IS 'Main game state for each user';
COMMENT ON TABLE taps IS 'Log of individual taps for analytics and anti-cheat';
COMMENT ON TABLE transactions IS 'All USDC transactions and purchases';
COMMENT ON TABLE shop_items IS 'Available items in the in-game shop';
COMMENT ON TABLE referrals IS 'Referral relationships and bonus tracking';
COMMENT ON TABLE quests IS 'Quest definitions and requirements';
COMMENT ON TABLE quest_progress IS 'User progress on individual quests';
COMMENT ON TABLE leaderboard_snapshots IS 'Historical leaderboard data for rewards';
COMMENT ON TABLE user_sessions IS 'User session tracking for security';
COMMENT ON TABLE battle_pass_rewards IS 'Rewards available at each battle pass level';
COMMENT ON TABLE user_battle_pass IS 'User progress in battle pass per season';

COMMENT ON VIEW leaderboard IS 'Real-time leaderboard ranked by bricks';
COMMENT ON VIEW user_stats IS 'Complete user statistics view';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

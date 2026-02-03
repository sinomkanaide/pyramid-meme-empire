# Pyramid Meme Empire - Database Schema

## Overview

PostgreSQL database schema for the Pyramid Meme Empire tap-to-earn game.

## Tables Structure

```
+------------------+     +------------------+     +------------------+
|      users       |     |  game_progress   |     |      taps        |
+------------------+     +------------------+     +------------------+
| id (PK)          |<--->| user_id (FK)     |     | user_id (FK)     |
| wallet_address   |     | bricks           |     | bricks_earned    |
| username         |     | level            |     | multiplier       |
| is_premium       |     | energy           |     | tapped_at        |
| has_battle_pass  |     | pme_tokens       |     +------------------+
| referral_code    |     | boost_multiplier |
| referred_by (FK) |     | total_taps       |
+------------------+     +------------------+

+------------------+     +------------------+     +------------------+
|   transactions   |     |   shop_items     |     |    referrals     |
+------------------+     +------------------+     +------------------+
| user_id (FK)     |     | name             |     | referrer_id (FK) |
| tx_hash          |     | slug             |     | referred_id (FK) |
| type             |     | price_usdc       |     | is_activated     |
| amount           |     | item_type        |     | bonus_claimed    |
| status           |     | multiplier       |     +------------------+
+------------------+     +------------------+

+------------------+     +------------------+
|     quests       |     | quest_progress   |
+------------------+     +------------------+
| title            |<--->| user_id (FK)     |
| quest_type       |     | quest_id (FK)    |
| requirement_type |     | current_progress |
| reward_type      |     | is_completed     |
+------------------+     | reward_claimed   |
                         +------------------+
```

## Quick Start

### 1. Initialize Database

```bash
cd backend
npm run db:init
```

### 2. Expected Output

```
PYRAMID MEME EMPIRE - Database Initialization
================================================

Reading schema.sql file...
Executing schema...

Full schema executed successfully!

Tables created:
   1. battle_pass_rewards
   2. game_progress
   3. leaderboard_snapshots
   4. quest_progress
   5. quests
   6. referrals
   7. shop_items
   8. taps
   9. transactions
   10. user_battle_pass
   11. user_sessions
   12. users

Views created:
   1. leaderboard
   2. user_stats

Shop items: 5
Quests: 8

================================================
DATABASE INITIALIZED SUCCESSFULLY!
================================================
```

## Tables Description

### 1. `users`
Main user accounts linked to wallet addresses.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| wallet_address | VARCHAR(42) | Unique Ethereum address |
| username | VARCHAR(50) | Optional display name |
| is_premium | BOOLEAN | Premium status |
| premium_expires_at | TIMESTAMP | Premium expiration |
| has_battle_pass | BOOLEAN | Battle pass status |
| referral_code | VARCHAR(20) | Unique referral code |
| referred_by | INTEGER | FK to referrer user |

### 2. `game_progress`
Main game state for each user.

| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER | FK to users |
| bricks | INTEGER | Total bricks collected |
| level | INTEGER | Current level |
| energy | INTEGER | Current energy (0-100) |
| max_energy | INTEGER | Max energy capacity |
| pme_tokens | DECIMAL | Earned PME tokens |
| boost_multiplier | DECIMAL | Active multiplier |
| total_taps | BIGINT | Lifetime tap count |

### 3. `taps`
Individual tap records (for analytics/anti-cheat).

| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER | FK to users |
| bricks_earned | INTEGER | Bricks from this tap |
| multiplier | DECIMAL | Active multiplier |
| energy_used | INTEGER | Energy consumed |
| session_id | UUID | Session tracking |
| is_valid | BOOLEAN | Anti-cheat flag |

### 4. `transactions`
USDC purchase records.

| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER | FK to users |
| tx_hash | VARCHAR(66) | Blockchain tx hash |
| type | VARCHAR(30) | premium, boost_x2, etc |
| amount | DECIMAL | USDC amount |
| status | VARCHAR(20) | pending/confirmed/failed |

### 5. `shop_items`
Available items in the shop.

| Column | Type | Description |
|--------|------|-------------|
| slug | VARCHAR(50) | Unique identifier |
| name | VARCHAR(50) | Display name |
| price_usdc | DECIMAL | Price in USDC |
| item_type | VARCHAR(30) | subscription/boost/consumable |
| duration_hours | INTEGER | Duration (NULL=permanent) |
| multiplier | DECIMAL | For boost items |

### 6. `referrals`
Referral tracking and bonuses.

| Column | Type | Description |
|--------|------|-------------|
| referrer_id | INTEGER | Who referred |
| referred_id | INTEGER | Who was referred |
| is_activated | BOOLEAN | Made purchase? |
| bonus_percent | DECIMAL | Bonus % earned |

### 7. `quests`
Quest definitions.

| Column | Type | Description |
|--------|------|-------------|
| title | VARCHAR(100) | Quest title |
| quest_type | VARCHAR(30) | social/game/achievement |
| requirement_type | VARCHAR(50) | twitter_follow/tap_count/etc |
| requirement_value | INTEGER | Required amount |
| reward_type | VARCHAR(30) | pme/energy/xp |

### 8. `quest_progress`
User progress on quests.

| Column | Type | Description |
|--------|------|-------------|
| user_id | INTEGER | FK to users |
| quest_id | INTEGER | FK to quests |
| current_progress | INTEGER | Current count |
| is_completed | BOOLEAN | Completed? |
| reward_claimed | BOOLEAN | Claimed reward? |

## Views

### `leaderboard`
Real-time ranking by bricks.

```sql
SELECT * FROM leaderboard LIMIT 10;
```

### `user_stats`
Complete user statistics including rank.

```sql
SELECT * FROM user_stats WHERE user_id = 1;
```

## Seeded Data

### Shop Items (5)
1. Battle Pass - $5/30 days
2. Premium - $2 (permanent)
3. Boost X2 - $0.50/24h
4. Boost X5 - $1.50/24h
5. Energy Refill - $0.25

### Quests (8)
1. Follow on X
2. Like Latest Post
3. Retweet
4. Join Telegram
5. Stack 100 Bricks
6. Stack 1000 Bricks
7. Invite a Friend
8. First Purchase

## Indexes

Performance indexes on:
- `users(wallet_address)` - Fast wallet lookups
- `users(referral_code)` - Referral code lookups
- `game_progress(bricks DESC)` - Leaderboard queries
- `taps(user_id, tapped_at)` - Tap history queries
- `transactions(user_id, status)` - Transaction queries

## Environment Variables

```env
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
```

## Common Queries

### Get user with stats
```sql
SELECT * FROM user_stats WHERE wallet_address = '0x...';
```

### Get top 10 leaderboard
```sql
SELECT * FROM leaderboard LIMIT 10;
```

### Get user's rank
```sql
SELECT rank FROM leaderboard WHERE user_id = 1;
```

### Get active quests for user
```sql
SELECT q.*, qp.current_progress, qp.is_completed
FROM quests q
LEFT JOIN quest_progress qp ON q.id = qp.quest_id AND qp.user_id = 1
WHERE q.is_active = TRUE
ORDER BY q.sort_order;
```

### Get referral stats
```sql
SELECT
  COUNT(*) as total_invited,
  COUNT(CASE WHEN is_activated THEN 1 END) as activated
FROM referrals
WHERE referrer_id = 1;
```

# Pyramid Meme Empire - Backend API

Backend API for the Pyramid Meme Empire tap-to-earn game on Base Network.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Auth**: JWT + Wallet Signature (EIP-191)
- **Blockchain**: Base Network (ethers.js)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Initialize Database

Make sure PostgreSQL is running, then:

```bash
npm run db:init
```

### 4. Start Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/nonce/:walletAddress` | Get nonce for signing |
| POST | `/api/auth/verify` | Verify signature & login |
| GET | `/api/auth/me` | Get current user info |

### Game

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/game/progress` | Get player progress |
| POST | `/api/game/tap` | Process a tap |
| POST | `/api/game/claim` | Claim PME tokens |
| GET | `/api/game/leaderboard` | Get top players |

### Shop

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shop/items` | Get shop items |
| POST | `/api/shop/purchase` | Process purchase |
| GET | `/api/shop/transactions` | Get transaction history |

## Authentication Flow

1. Frontend requests nonce: `GET /api/auth/nonce/{wallet}`
2. User signs message with wallet
3. Frontend sends signature: `POST /api/auth/verify`
4. Backend verifies signature and returns JWT
5. Frontend includes JWT in all subsequent requests

## Database Schema

### Users
- `id`, `wallet_address`, `username`
- `is_premium`, `premium_expires_at`
- `referral_code`, `referred_by`

### Game Progress
- `user_id`, `bricks`, `level`, `pme_tokens`
- `energy`, `boost_multiplier`, `boost_expires_at`
- `total_taps`, `last_tap_at`

### Transactions
- `user_id`, `tx_hash`, `type`, `amount`
- `status`, `item_purchased`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `BASE_RPC_URL` | Base network RPC endpoint |
| `USDC_CONTRACT_ADDRESS` | USDC contract on Base |
| `SHOP_WALLET_ADDRESS` | Wallet to receive payments |
| `FRONTEND_URL` | Frontend URL for CORS |

## Deployment

### Railway / Render

1. Connect your GitHub repo
2. Set environment variables
3. Deploy!

### Manual (VPS)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/server.js --name pyramid-backend

# Save PM2 config
pm2 save
```

## Security Notes

- All wallet signatures are verified using EIP-191
- JWT tokens expire after 7 days
- Rate limiting on tap endpoint (30/min)
- USDC transfers verified on-chain before applying purchases
- SQL injection prevented via parameterized queries

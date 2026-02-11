# TAPKAMUN Public API

**Base URL:** `https://api.tapkamun.fun`

Public endpoints for partner integrations (Galxe, KiiChain, etc). No authentication required.

**Rate Limit:** 60 requests/minute per IP

---

## Endpoints

### 1. Check Premium Status

```
GET /api/public/check/premium/{wallet_address}
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "isPremium": true,
  "premiumExpiresAt": null,
  "isPermanent": true
}
```

**cURL:**
```bash
curl https://api.tapkamun.fun/api/public/check/premium/0xYOUR_WALLET
```

---

### 2. Check Battle Pass

```
GET /api/public/check/battlepass/{wallet_address}
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "hasBattlePass": true,
  "battlePassExpiresAt": "2026-03-15T00:00:00.000Z",
  "daysRemaining": 22
}
```

**cURL:**
```bash
curl https://api.tapkamun.fun/api/public/check/battlepass/0xYOUR_WALLET
```

---

### 3. Check Paid Status (Premium OR Battle Pass)

Best endpoint for Galxe quests requiring any purchase.

```
GET /api/public/check/paid/{wallet_address}
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "hasPaid": true,
  "isPremium": true,
  "hasBattlePass": false
}
```

**Galxe Configuration:**
- Endpoint: `https://api.tapkamun.fun/api/public/check/paid/{address}`
- Success Expression: `data.hasPaid === true`

**cURL:**
```bash
curl https://api.tapkamun.fun/api/public/check/paid/0xYOUR_WALLET
```

---

### 4. Check Level

```
GET /api/public/check/level/{wallet_address}
GET /api/public/check/level/{wallet_address}?min=10
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "level": 15,
  "meetsRequirement": true
}
```

**Galxe Configuration (Level 10+ quest):**
- Endpoint: `https://api.tapkamun.fun/api/public/check/level/{address}?min=10`
- Success Expression: `data.meetsRequirement === true`

**cURL:**
```bash
curl "https://api.tapkamun.fun/api/public/check/level/0xYOUR_WALLET?min=10"
```

---

### 5. Check Taps

```
GET /api/public/check/taps/{wallet_address}
GET /api/public/check/taps/{wallet_address}?min=1000
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "totalTaps": 5430,
  "totalBricksEarned": 12500,
  "meetsRequirement": true
}
```

**Galxe Configuration (1000+ taps quest):**
- Endpoint: `https://api.tapkamun.fun/api/public/check/taps/{address}?min=1000`
- Success Expression: `data.meetsRequirement === true`

**cURL:**
```bash
curl "https://api.tapkamun.fun/api/public/check/taps/0xYOUR_WALLET?min=1000"
```

---

### 6. Check Quest Completion

```
GET /api/public/check/quest/{questId}/{wallet_address}
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "questId": "1",
  "questCompleted": true,
  "completedAt": "2026-02-10T12:30:00.000Z",
  "xpEarned": 500
}
```

**cURL:**
```bash
curl https://api.tapkamun.fun/api/public/check/quest/1/0xYOUR_WALLET
```

---

### 7. Full Profile

Returns all game data for a wallet.

```
GET /api/public/check/profile/{wallet_address}
```

**Response:**
```json
{
  "exists": true,
  "wallet": "0xabc...def",
  "level": 15,
  "xp": 12500,
  "bricks": 34000,
  "totalTaps": 5430,
  "totalBricksEarned": 45000,
  "isPremium": true,
  "hasBattlePass": false,
  "hasPaid": true,
  "questsCompleted": 6,
  "questXP": 7100,
  "joinedAt": "2026-02-01T00:00:00.000Z"
}
```

**cURL:**
```bash
curl https://api.tapkamun.fun/api/public/check/profile/0xYOUR_WALLET
```

---

## Wallet Not Found

If the wallet has never used TAPKAMUN:

```json
{
  "exists": false,
  "wallet": "0xabc...def",
  "isPremium": false
}
```

---

## Error Responses

**Invalid wallet address (400):**
```json
{ "error": "Invalid wallet address", "exists": false }
```

**Rate limited (429):**
```json
{ "error": "Rate limit exceeded", "retryAfter": 45, "limit": 60, "window": "60s" }
```

---

## Galxe Integration Guide

1. Create a new quest on Galxe
2. Select "API Verification" as credential type
3. Configure:
   - **API URL:** `https://api.tapkamun.fun/api/public/check/paid/{address}`
   - **Method:** GET
   - **Success Expression:** `data.hasPaid === true`
4. The `{address}` placeholder will be replaced by Galxe with the user's wallet

### Example Quest Configurations

| Quest | Endpoint | Expression |
|-------|----------|------------|
| Buy Premium or BP | `/check/paid/{address}` | `data.hasPaid === true` |
| Reach Level 10 | `/check/level/{address}?min=10` | `data.meetsRequirement === true` |
| Do 1000 Taps | `/check/taps/{address}?min=1000` | `data.meetsRequirement === true` |
| Complete Quest #1 | `/check/quest/1/{address}` | `data.questCompleted === true` |

---

## Security

- No authentication required (public endpoints)
- Rate limited: 60 req/min per IP
- Only game data exposed (no emails, no OAuth tokens, no internal IDs)
- Wallet addresses normalized to lowercase
- All timestamps in ISO 8601 format

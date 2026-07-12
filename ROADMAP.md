# TAPKAMUN — Roadmap

Future work, not yet implemented. Newest ideas on top.

## Gamify trades — Bridge/Swap earns XP

**Idea:** Every bridge or swap a user does in the **BRIDGE** tab (LI.FI widget)
awards **XP that counts toward their level**. More volume per trade = more XP
(e.g. XP scales with the USD amount swapped/bridged), plus a base XP per trade.
Turns onboarding/funding into a rewarded, sticky loop.

**How it could work:**
- **Detect completed trades** on the frontend via the LI.FI widget events —
  the widget exports `useWidgetEvents` / `widgetEvents` (from `@lifi/widget`).
  Subscribe to the route-completion event (e.g. `RouteExecutionCompleted`),
  which carries the executed route (txHash, chains, tokens, amounts).
- **Award XP via the backend** — new endpoint (e.g. `POST /api/game/trade-xp`)
  that receives the completed route, and grants XP toward the user's level.
  Reuse the existing XP/level system in `backend/src/models/GameProgress.js`
  (`calculateLevelFromXp`, level formula `100 * level^1.5` cumulative).
- **XP formula** — base XP per trade + a volume component (USD value of the
  trade). Cap the volume component so whales don't skip the whole curve.

**Anti-abuse (critical — real money moves here):**
- **Verify on-chain** before granting: confirm the txHash really executed and
  belongs to the authenticated wallet (reuse the pattern in
  `backend/src/services/paymentService.js`).
- **Dedupe by txHash** (same anti-replay idea as `shop.js`) so a trade can't be
  claimed twice.
- **Daily XP cap** from trades, and a **minimum volume** per trade, so users
  can't wash-trade tiny amounts back and forth to farm XP.
- Consider only counting trades whose **destination is Robinhood Chain** (real
  onboarding), not round-trips out.

**Touch points:** `src/components/BridgeView.jsx` (subscribe to widget events →
call backend), backend new route + `GameProgress`, and the level/XP UI already
in `src/pyramid-meme-empire.jsx`.

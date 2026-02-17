# TAPKAMUN.FUN - Project Context (formerly Pyramid Meme Empire)

> Last Updated: 2026-02-16
> Status: **Production Ready** - Share cards, Galxe integration, Premium tap fix, All systems GO

---

## A. RESUMEN EJECUTIVO

### Estado Actual
- **Frontend**: Deployed en Vercel, funcionando
- **Backend**: Deployed en Railway, funcionando
- **Database**: PostgreSQL en Railway, funcionando
- **Quest System**: ✅ FUNCIONANDO (GO abre link, VERIFY otorga puntos)

### Ultimo Commit
```
70710d6 - security: comprehensive security audit + rate limiting + input validation
```

### Features Status
| Feature | Status | Notes |
|---------|--------|-------|
| Tap to Earn | ✅ | Funciona con energy, cooldown, XP |
| Shop (5 items) | ✅ | Premium, Battle Pass, Boosts |
| Battle Pass | ✅ | X5 boost, unlimited energy, 30 days |
| Referral System | ✅ | Bonus +10% per verified referral |
| Leaderboard | ✅ | Top 100 players |
| Quest System | ✅ | 8 quests, GO/VERIFY working |
| Multi-wallet | ✅ | MetaMask, Phantom, Trust Wallet, deduplication |
| Twitter OAuth | ✅ | PKCE flow, connect/disconnect/status |
| Discord OAuth | ✅ | OAuth 2.0, connect/disconnect/status |
| SEO / Branding | ✅ | OG tags, Twitter cards, manifest, robots.txt |
| Logo / Favicon | ✅ | Golden paw logo, banner text |
| Share Cards | ✅ | Canvas-rendered PNG, share via X/Telegram/Download |
| Galxe Integration | ✅ | CORS, public API, success expressions |

---

## B. ARQUITECTURA ACTUAL

### URLs de Produccion
```
Frontend:  https://pyramid-meme-empire.vercel.app
Backend:   https://api.tapkamun.fun
Health:    https://api.tapkamun.fun/health
```

### GitHub
```
Repo:   https://github.com/sinomkanaide/pyramid-meme-empire
Branch: main
```

### Estructura de Base de Datos (PostgreSQL)

```sql
-- USERS
users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(100) UNIQUE,
  telegram_id VARCHAR(50),
  username VARCHAR(100),
  is_premium BOOLEAN DEFAULT false,
  has_battle_pass BOOLEAN DEFAULT false,
  battle_pass_expires_at TIMESTAMP,
  referral_code VARCHAR(20) UNIQUE,
  referred_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- GAME PROGRESS
game_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  bricks INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  energy INTEGER DEFAULT 100,
  total_taps INTEGER DEFAULT 0,
  total_bricks_earned INTEGER DEFAULT 0,
  boost_multiplier DECIMAL DEFAULT 1,
  boost_type VARCHAR(10),
  boost_expires_at TIMESTAMP,
  pme_tokens INTEGER DEFAULT 0,
  last_tap_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- QUESTS (esquema existente - NO modificar)
quests (
  id SERIAL PRIMARY KEY,
  title VARCHAR,
  description TEXT,
  icon VARCHAR,
  quest_type VARCHAR,           -- 'social', 'milestone', etc.
  requirement_type VARCHAR,     -- 'twitter_follow', 'twitter_like', etc.
  requirement_value INTEGER,
  requirement_metadata JSONB,   -- {url: "https://...", handle: "@..."}
  reward_type VARCHAR,
  reward_amount INTEGER,
  is_active BOOLEAN,
  sort_order INTEGER
)

-- QUEST COMPLETIONS
quest_completions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  quest_id VARCHAR(50),         -- Stores quest.id as string
  xp_earned INTEGER,
  completed_at TIMESTAMP,
  is_verified BOOLEAN,
  UNIQUE(user_id, quest_id)
)

-- REFERRALS
referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER REFERENCES users(id),
  referred_id INTEGER REFERENCES users(id),
  is_activated BOOLEAN DEFAULT false,
  activated_at TIMESTAMP,
  created_at TIMESTAMP
)

-- TAPS (analytics)
taps (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  bricks_earned INTEGER,
  multiplier DECIMAL,
  energy_used INTEGER,
  session_id VARCHAR,
  ip_address VARCHAR,
  created_at TIMESTAMP
)
```

### Variables de Entorno

**Backend (.env en Railway):**
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
NODE_ENV=production
FRONTEND_URL=https://pyramid-meme-empire.vercel.app
```

**Frontend (Vercel):**
```
VITE_API_URL=https://api.tapkamun.fun
```

---

## C. FEATURES IMPLEMENTADAS HOY

### 1. Battle Pass System
- Precio: $9.99 (simulated)
- Duracion: 30 dias
- Beneficios: X5 boost permanente, unlimited energy, no cooldown
- UI: Banner especial, timer de dias restantes

### 2. Quest System (8 quests)
```
Social Quests (verification_method: 'manual'):
1. Follow on X        - 50 XP   - twitter_follow  (default, admin-editable)
2. Like Latest Post   - 25 XP   - twitter_like    (default, admin-editable)
3. Retweet           - 50 XP   - twitter_retweet  (default, admin-editable)
4. Join Discord      - 50 XP   - discord_join     (default, admin-editable)
5. Join Telegram     - 50 XP   - telegram_join    (default, admin-editable)

Partner Quests:
6. KiiChain Testnet  - +20% tap bonus - partner_quest (no XP)

Milestone Quests (verification_method: 'internal'):
7. Reach Level 10    - 100 XP  - level_milestone
8. Invite 5 Friends  - 150 XP  - referral_milestone
```

**Level XP Formula:** `100 * (level^1.5)` cumulative
- Level 1→2: 100 XP | Level 2→3: 282 XP | Level 3→4: 519 XP
- Free users capped at Level 3 (premium unlimited)

### 3. Multi-wallet Support
- MetaMask (prioritario)
- Phantom (detectado via window.phantom.ethereum)
- Trust Wallet (detectado via isTrust/isTrustWallet)
- Deduplication via Set (previene duplicados)
- Auto-fallback si un wallet falla

---

## D. BUGS ARREGLADOS HOY

| Bug | Commit | Solucion |
|-----|--------|----------|
| Arena overlay corrupted | 6b37a05 | Fixed positioning outside scroll container |
| Wrong prize text | 6b37a05 | Changed to "$1,000 USDC prizes" |
| Battle Pass timer mixed with Boost | 6b37a05 | Separated banners |
| Phantom shows as MetaMask | f14d527 | Check Phantom first in getWalletProvider |
| Quests not loading after connect | 21fd0a1 | Load quests directly in connectWallet |
| /api/quests 500 error | 680e89d | Added table initialization, better error handling |
| All quests loading at once | 1b6f7b2 | Removed loadQuests() call after complete |
| questId undefined | ae7b4eb | Fixed Quest model to transform DB schema |

---

## E. QUEST SYSTEM - SOLUCION APLICADA

### Problema Original
La base de datos tenia un esquema diferente al esperado:
- DB usa `id` (numero) pero frontend esperaba `quest_id` (string)
- DB usa `quest_type` pero frontend esperaba `type`
- DB usa `requirement_metadata.url` pero frontend esperaba `external_url`

### Solucion Implementada
Creamos `transformQuest()` en `backend/src/models/Quest.js`:

```javascript
static transformQuest(dbQuest) {
  return {
    quest_id: String(dbQuest.id),        // "1", "2", etc.
    type: dbQuest.quest_type,            // "social"
    verification_method: 'manual',        // Based on requirement_type
    xp_reward: XP_REWARDS[dbQuest.requirement_type] || 500,
    external_url: dbQuest.requirement_metadata?.url,
    // ... other fields
  };
}
```

### Estado Actual: ✅ FUNCIONANDO
- Boton GO abre el link externo
- Boton VERIFY completa la quest y otorga XP
- Loading individual por quest (no todos a la vez)

---

## F. PROXIMOS PASOS

### Prioridad Alta
1. ✅ ~~Fix questId undefined~~ - COMPLETADO
2. ✅ ~~Implementar GO/VERIFY buttons~~ - COMPLETADO
3. 📋 Progress bars para milestone quests (mostrar barra visual)
4. 📋 Twitter OAuth real (verificacion automatica)

### Prioridad Media
5. 📋 Notificaciones push cuando quest completable
6. 📋 Daily quests con reset
7. 📋 Quest rewards en $KAMUN tokens (no solo XP)

### Prioridad Baja
8. 📋 Leaderboard por quests completadas
9. 📋 Achievement badges
10. 📋 Quest streaks

---

## G. COMANDOS UTILES

### Git
```bash
# Ver ultimos commits
cd "C:/Users/Juegos/pyramid-meme-empire" && git log --oneline -10

# Push cambios
git add -A && git commit -m "mensaje" && git push

# Force redeploy (commit vacio)
git commit --allow-empty -m "Force redeploy" && git push
```

### Verificar Produccion
```bash
# Health check
curl -s -k https://api.tapkamun.fun/health

# Ver estado de tablas
curl -s -k https://api.tapkamun.fun/api/diagnostics/tables

# Ver quests transformadas
curl -s -k https://api.tapkamun.fun/api/diagnostics/quests-sample

# Test body parsing
curl -s -k -X POST "https://api.tapkamun.fun/api/test-body" \
  -H "Content-Type: application/json" \
  -d '{"questId":"1"}'
```

### Claude Code
```bash
# Iniciar Claude Code
claude

# Continuar sesion
# Solo di: "Lee PROJECT_CONTEXT.md y continuamos"
```

---

## H. NOTAS IMPORTANTES

### Vercel Cache
- A veces Vercel no detecta cambios automaticamente
- Solucion: `git commit --allow-empty -m "Force redeploy" && git push`
- O hacer hard refresh en browser: `Ctrl+Shift+R`

### Railway Deploy
- Tarda 1-2 minutos en redeploy
- Verificar con `/health` endpoint antes de probar

### Base de Datos
- **NO modificar esquema de tabla `quests`** - ya tiene datos
- Usar `transformQuest()` para adaptar formato
- `quest_completions` usa `quest_id` como VARCHAR (string del id)

### Frontend State
- `completingQuest` = quest_id de la quest en proceso (para loading individual)
- `questsLoading` = solo para carga inicial de lista
- Quests vienen del API con formato transformado

### Endpoints Diagnostico (sin auth)
```
GET  /health                        - Status del server
GET  /api/diagnostics/tables        - Estado de tablas DB
GET  /api/diagnostics/quests-sample - Quests transformadas
POST /api/diagnostics/init-quests   - Reinicializar tablas
POST /api/test-body                 - Test body parsing
```

---

## ARCHIVOS CLAVE

```
Frontend:
  src/pyramid-meme-empire.jsx    - Componente principal (2500+ lineas)

Backend:
  backend/src/server.js          - Express server, rutas, middleware
  backend/src/models/Quest.js    - Modelo Quest con transformQuest()
  backend/src/routes/quests.js   - Endpoints /api/quests/*
  backend/src/routes/game.js     - Endpoints /api/game/* (tap, progress)
  backend/src/routes/shop.js     - Endpoints /api/shop/*
  backend/src/middleware/auth.js - JWT authentication
```

---

## PARA CONTINUAR MANANA

1. Abre PowerShell en `C:\Users\Juegos\pyramid-meme-empire`
2. Ejecuta `claude`
3. Di: **"Lee PROJECT_CONTEXT.md y continuamos desde donde quedamos"**
4. Claude tendra todo el contexto necesario

---

*Documento generado automaticamente - Session 2026-02-05*

---

## SESIÓN 2026-02-05 (Noche) - ADMIN PANEL + QUEST VERIFICATION SYSTEM

### FEATURES IMPLEMENTADAS:

1. **SISTEMA DE PAGOS USDC REAL (Base Network)**
   - Commit: a7dcca2
   - paymentService.js con verificación on-chain
   - Verificación de: sender, recipient, monto, confirmaciones (2+)
   - Anti-replay: txHash único en DB
   - Frontend con estados: signing → confirming → verifying → done
   - Shop 100% funcional con pagos reales
   - Wallet de pagos: 0x323fF56B329F2bD3680007f8E6c4D9d48c7f3027

2. **QUEST KIICHAIN CON API REAL**
   - Commit: d9a5732
   - Verificación vía API: https://backend.testnet.kiivalidator.com/users/check/{wallet}
   - Recompensa: +20% bonus en taps por 30 días (NO XP)
   - Bonus independiente de Battle Pass
   - Columnas nuevas: quest_bonus_multiplier, quest_bonus_expires_at
   - Fórmula: baseXP × boost × battlePass × referral × questBonus
   - Máximo posible: 8.58x (BP + X5 + 3 refs + KiiChain)

3. **ADMIN PANEL COMPLETO**
   - Commits: múltiples
   - App separada en /admin (Vite + React)
   - Deployed: https://pyramid-meme-empire-jxrk.vercel.app
   - Auth: wallet 0x323fF56B329F2bD3680007f8E6c4D9d48c7f3027 + password
   - Token JWT con role 'admin' (8h expiry)
   - Backend: 15+ endpoints en /api/admin/*

4. **ANALYTICS DASHBOARD**
   - 4 secciones completas: Overview, Users, Revenue, Engagement
   - Cards de métricas con % cambio vs semana anterior
   - 4 gráficas con Recharts:
     * Nuevos usuarios por día (30d) - cyan neón
     * Revenue por día (30d) - dorado neón
     * Revenue por item (bar chart multicolor)
     * Usuarios activos por día (30d) - verde neón
   - Métricas de negocio: ARPU, conversión, retention
   - Level distribution, quest completions
   - Estética retro arcade neón (morado/cyan/dorado)

5. **QUEST MANAGEMENT**
   - CRUD completo de quests desde admin
   - Quest creator dinámico con campos según tipo
   - 3 tipos de verificación:
     * 🧠 Smart (psicológica) - para social quests
     * 🔗 API (real) - para partner quests
     * 🎮 Auto - para game quests

6. **VERIFICACIÓN PSICOLÓGICA (Social Quests)**
   - Commit: a26407a
   - Sistema frontend-only para Twitter/Telegram/Discord
   - Flujo:
     1. Sin GO → rechazo inmediato
     2. <10s después GO → "verificando..." → rechazo
     3. 1er intento → SIEMPRE falla + cooldown 15s
     4. 2do intento → 50% falla + cooldown 10s
     5. 3er intento → SIEMPRE pasa
   - Mensajes realistas: "Checking Twitter API...", etc.
   - Estado en memoria (NO localStorage)
   - Presiona psicológicamente a completar la tarea

7. **PARTNER API QUESTS**
   - Sistema configurable desde admin
   - Campos: API endpoint, HTTP method, headers, success expression
   - Placeholder {address} se reemplaza con wallet del usuario
   - Rewards: XP o Boost (% + días)
   - Verificación real en backend
   - Ejemplo: KiiChain quest

8. **LEADERBOARD SEASONS**
   - Tabla leaderboard_seasons
   - CRUD: crear/activar/eliminar seasons
   - Filtro por season (Current / All Time)
   - Prize pool configurable
   - Preparado para torneos semanales/mensuales

9. **USER MANAGEMENT**
   - Lista con búsqueda, filtros, paginación
   - Detalle expandible (progress, transactions, quests, referrals)
   - Acciones admin:
     * Grant XP (con reason logueado)
     * Grant Premium
     * Grant Battle Pass
     * Ban/Unban
   - Tabla admin_xp_grants para auditoría

### BUGS ARREGLADOS:

1. **CORS Admin Panel**
   - Admin .env en .gitignore → Vercel sin VITE_API_URL
   - Fix: Fallback hardcodeado a Railway URL
   - Admin URL agregada a CORS backend

2. **Wallet Validation**
   - Login permitía wallets incorrectas
   - Fix: Validación doble (endpoint + middleware)
   - Solo permite: 0x323fF56B329F2bD3680007f8E6c4D9d48c7f3027

3. **Dashboard Engagement Error**
   - Endpoint /analytics/engagement crasheaba todo
   - Causa: Queries con columnas incorrectas (created_at vs tapped_at, item_type vs type)
   - Tablas faltantes: quest_completions, admin_xp_grants, leaderboard_prizes
   - Fix: Try-catch individual por métrica
   - Fix: Auto-init de tablas en startup
   - Fix: Datos parciales si alguna query falla
   - Endpoint diagnóstico: GET /api/admin/db-check

4. **Estética Admin**
   - Tema genérico oscuro
   - Fix: Retro arcade neón acorde al juego
   - Colores: morado neón (#8b5cf6), cyan (#00ffff), dorado (#ffd700)
   - Font: Courier New monospace
   - Glow effects, gradientes, text-shadow

### VARIABLES DE ENTORNO NUEVAS:

**Railway (Backend):**
- SHOP_WALLET_ADDRESS=0x323fF56B329F2bD3680007f8E6c4D9d48c7f3027
- ADMIN_PASSWORD=[contraseña segura]
- ADMIN_WALLET=0x323fF56B329F2bD3680007f8E6c4D9d48c7f3027
- ADMIN_PANEL_URL=https://pyramid-meme-empire-jxrk.vercel.app

**Vercel (Admin):**
- VITE_API_URL=https://api.tapkamun.fun

### ESTRUCTURA DE ARCHIVOS NUEVOS:

```
/admin                              (Admin panel app separada)
├── package.json
├── vite.config.js
├── src/
│   ├── App.jsx                     (routing + auth)
│   ├── components/
│   │   ├── Login.jsx               (wallet + password)
│   │   ├── Dashboard.jsx           (analytics + gráficas)
│   │   ├── QuestManager.jsx        (CRUD quests)
│   │   ├── UserManager.jsx         (user actions)
│   │   ├── LeaderboardManager.jsx  (seasons + prizes)
│   │   └── XPGrantModal.jsx        (grant XP)
│   └── styles/
│       └── admin.css               (retro arcade neón)
/backend/src/
├── routes/
│   └── admin.js                    (15+ endpoints admin)
├── services/
│   └── paymentService.js           (verificación USDC on-chain)
└── middleware/
    └── auth.js                     (adminAuth middleware)
```

### DEPLOYMENT:

- **Frontend Principal:** https://pyramid-meme-empire.vercel.app
- **Admin Panel:** https://pyramid-meme-empire-jxrk.vercel.app
- **Backend:** https://api.tapkamun.fun

### TESTING REALIZADO:

- ✅ Pagos USDC funcionando (Energy Refill testeado)
- ✅ Quest KiiChain con API real
- ✅ Verificación psicológica de quests sociales
- ✅ Admin login con wallet correcta
- ✅ Dashboard cargando sin errores
- ✅ Quest creator dinámico
- ✅ User manager con acciones

### PENDIENTES PARA MAÑANA:

1. Crear cuentas sociales reales:
   - Twitter: @PyramidMeme (o similar)
   - Discord: servidor Pyramid Meme Empire
   - Telegram: canal/grupo

2. Actualizar URLs en quests con enlaces reales

3. Opcional - Discord bot para verificación real

4. Marketing y lanzamiento oficial

### NOTAS IMPORTANTES:

- Dashboard del admin usa endpoint /db-check para verificar schema
- Todas las tablas se auto-crean en startup si no existen
- Error handling robusto: datos parciales si algo falla
- Verificación psicológica es frontend-only, no cambia backend
- Partner quests soportan cualquier API con config personalizada
- Leaderboard preparado para torneos con seasons

---

## SESIÓN 2026-02-10 - REBRAND + BRANDING + OAUTH + WALLET FIXES

### REBRAND: Pyramid Meme Empire → TAPKAMUN.FUN

- **Commit**: 16c29c6 - rebrand completo
- Token: $PME → $KAMUN
- Solo cambios user-visible (NO file names, variables, CSS classes, DB tables)
- 17 archivos modificados

### API URL MIGRATION

- **Commit**: a08d900 - feat: update API URL to api.tapkamun.fun
- Frontend + Admin apuntan a `https://api.tapkamun.fun`
- CORS: tapkamun.fun + www + api + todas las URLs antiguas como fallback
- `.env.example` actualizado

### BRANDING VISUAL COMPLETO

- **Commits**: c5ea893, 8c84020, e5f780f, 667ad94
- Logo: pata dorada pixelada con "T" (logo.webp en /public/)
- Banner: "TAPKAMUN.FUN" texto pixel dorado (banner.webp en /public/)
- Header del juego: texto "TAPKAMUN" color dorado #F5C800 con text-shadow
- Favicon: logo.webp (principal + admin)
- Admin login: logo image con glow animation

**SEO Meta Tags (index.html):**
- Open Graph: title, description, image (banner.webp)
- Twitter Cards: summary_large_image
- Keywords, canonical URL, robots, author, language
- theme-color: #8b5cf6

**Nuevos archivos:**
- `/public/logo.webp` - Logo pata dorada
- `/public/banner.webp` - Banner texto TAPKAMUN.FUN
- `/public/manifest.json` - PWA manifest
- `/public/robots.txt` - SEO robots

### WALLET CONNECTION FIXES

- **Commit**: a356a40 - fix: Phantom EVM bridge error handling
  - Handle "Me: Unexpected error" from Phantom's evmAsk.js
  - Auto-fallback: si Phantom falla, intenta MetaMask automáticamente
  - Mejor detección de Phantom cuando hijackea window.ethereum

- **Commit**: 7fabf7d - fix: nonce TTL + auto-retry
  - Nonce TTL ya era 5min (300s) - confirmado
  - Backend logging: `[Nonce] Created...`, `[Verify] Nonce age...`
  - Frontend: auto-retry loop (max 2 intentos) si nonce expira
  - Re-pide nonce + re-firma sin interacción del usuario

### TWITTER & DISCORD OAuth

- **Commit**: 6993ba2 - feat: Twitter and Discord OAuth
- **Commit**: 79b973e - fix: Twitter OAuth scopes + encoding

**Backend** (`backend/src/routes/oauth.js` - NUEVO):
```
GET  /api/oauth/twitter/connect      - Genera URL de autorización (PKCE)
GET  /api/oauth/twitter/callback     - Recibe callback, guarda id+username
GET  /api/oauth/twitter/status       - Check si está conectado
POST /api/oauth/twitter/disconnect   - Desconectar

GET  /api/oauth/discord/connect      - Genera URL de autorización
GET  /api/oauth/discord/callback     - Recibe callback, guarda id+username
GET  /api/oauth/discord/status       - Check si está conectado
POST /api/oauth/discord/disconnect   - Desconectar

GET  /api/oauth/status               - Estado de ambas cuentas
```

**DB Migration** (auto en startup):
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_id VARCHAR(100)`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_username VARCHAR(100)`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id VARCHAR(100)`
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_username VARCHAR(100)`

**Frontend:**
- Sección "CONNECTED ACCOUNTS" en tab Quests
- Botones Connect X / Connect Discord
- Username verde cuando conectado, botón ✕ para desconectar
- Social quests requieren cuenta: VERIFY → "🔗 X" o "🔗 DC" si no conectado
- Verificación psicológica usa username real:
  - `"Checking if @juanperez follows @tapkamun..."`
  - `"Scanning @juanperez's recent likes..."`

**Variables de entorno (Railway):**
```
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
TWITTER_CALLBACK_URL=https://api.tapkamun.fun/api/oauth/twitter/callback
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_CALLBACK_URL=https://api.tapkamun.fun/api/oauth/discord/callback
```

**OAuth Notes:**
- Twitter usa PKCE (S256) - NO guarda access tokens
- Solo guarda id + username en DB
- State parameter incluye origin para redirect correcto
- Scopes: `tweet.read users.read` (sin follows.read)
- URL construida manual con encodeURIComponent (%20 no +)
- Logging detallado en callbacks

### ESTRUCTURA DE ARCHIVOS ACTUALIZADA

```
/public/
├── logo.webp                         (Logo pata dorada - favicon + PWA)
├── banner.webp                       (Banner texto TAPKAMUN.FUN - OG image)
├── manifest.json                     (PWA manifest)
├── robots.txt                        (SEO)
├── coins/                            (Memecoin sprites)
└── sounds/                           (SFX)

/backend/src/routes/
├── admin.js                          (Admin endpoints)
├── auth.js                           (Nonce + verify + JWT)
├── game.js                           (Taps, energy, progress)
├── oauth.js                          (Twitter + Discord OAuth) ← NUEVO
├── quests.js                         (Quest CRUD + completion)
├── referrals.js                      (Referral system)
└── shop.js                           (Shop + payments)
```

### COMMITS ESTA SESIÓN

| Commit | Descripción |
|--------|-------------|
| a08d900 | feat: update API URL to api.tapkamun.fun |
| c5ea893 | feat: add TAPKAMUN branding with logos and SEO meta tags |
| 8c84020 | fix: use local logo/banner assets instead of Discord CDN |
| a356a40 | fix: improve wallet connection error handling for Phantom |
| 7fabf7d | fix: increase nonce TTL to 5min and add auto-retry |
| e5f780f | fix: use banner text logo instead of paw icon in game header |
| 667ad94 | fix: replace logo image with golden TAPKAMUN text in header |
| 6993ba2 | feat: Twitter and Discord OAuth connection for quest verification |
| 79b973e | fix: Twitter OAuth authorize endpoint and scopes |
| 07949c3 | feat: public verification API for partner integrations (Galxe) |
| 1b24485 | feat: add sitemap.xml for SEO |

### PUBLIC API PARA PARTNERS (Galxe / KiiChain)

- **Commit**: 07949c3
- **Archivo**: `backend/src/routes/public.js` (NUEVO)
- **Docs**: `backend/PUBLIC_API.md`
- **CORS**: Abierto para todos los orígenes (`origin: '*'`)
- **Rate Limit**: 60 req/min por IP
- **Auth**: NO requiere autenticación

**Endpoints (todos GET, sin auth):**
```
/api/public/check/premium/:address      - Premium activo?
/api/public/check/battlepass/:address    - Battle Pass activo?
/api/public/check/paid/:address          - Premium O Battle Pass?
/api/public/check/level/:address?min=N   - Nivel del usuario
/api/public/check/taps/:address?min=N    - Taps totales
/api/public/check/quest/:questId/:address - Quest completada?
/api/public/check/profile/:address       - Perfil completo
```

**Galxe Config:**
| Quest | Endpoint | Expression |
|-------|----------|------------|
| Comprar Premium/BP | `/api/public/check/paid/{address}` | `data.hasPaid === true` |
| Nivel 10+ | `/api/public/check/level/{address}?min=10` | `data.meetsRequirement === true` |
| 1000+ Taps | `/api/public/check/taps/{address}?min=1000` | `data.meetsRequirement === true` |
| Quest #1 completada | `/api/public/check/quest/1/{address}` | `data.questCompleted === true` |

**Test:**
```bash
curl https://api.tapkamun.fun/api/public/check/profile/0x323fF56B329F2bD3680007f8E6c4D9d48c7f3027
```

### PENDIENTES

1. ✅ ~~Verificar OAuth en producción con cuentas reales~~ - FUNCIONANDO
2. ✅ ~~Public API para partners~~ - FUNCIONANDO
3. ⬜ Agregar `follows.read` scope si Twitter lo permite
4. ⬜ Progress bars visuales para milestone quests
5. ⬜ Daily quests con reset
6. ⬜ Quest rewards en $KAMUN tokens
7. ✅ ~~Sitemap.xml para SEO completo~~ - public/sitemap.xml
8. ⬜ Telegram OAuth (si se quiere verificar Telegram)

---

## SESIÓN 2026-02-11 - BUGFIXES: REFERRALS, QUEST XP, WALLET DETECTION

### BUGS ENCONTRADOS Y ARREGLADOS

#### 1. Referrals mostrando 3 para todos los usuarios
- **Commit**: d771427
- **Causa raíz**: `const [referrals, setReferrals] = useState(3)` hardcodeado en línea 105, nunca actualizado desde backend
- **Display**: Línea 2486 usaba `{referrals}` en vez de `{referralStats.total}`
- **Fix**: Eliminado el state `referrals` innecesario, display usa `{referralStats.total}` que ya se carga correctamente del backend vía `loadProgress()`

#### 2. Quest XP no actualizaba el nivel
- **Commit**: d771427
- **Causa raíz**: `completeQuest()` en frontend no llamaba `loadProgress()` después de completar quest
- **Fix**: Agregado `await loadProgress()` después del éxito, refresca level/XP/bricks en UI

#### 3. Wallet detection - Trust Wallet duplica 4x MetaMask
- **Commit**: 6e467b0
- **Causa raíz**: Trust Wallet inyecta su provider con `isMetaMask: true` para compatibilidad. El loop no deduplicaba ni detectaba Trust Wallet
- **Fix**: Deduplicación con `Set`, detección de Trust Wallet via `isTrust`/`isTrustWallet` antes de `isMetaMask`

#### 4. Wallet detection - MetaMask + Phantom no muestra selector
- **Commit**: 6e467b0
- **Causa raíz**: `window.ethereum.providers` array puede existir pero solo contener MetaMask. El código solo revisaba `window.phantom.ethereum` cuando `wallets.length === 0`
- **Fix**: SIEMPRE revisa `window.phantom.ethereum` como namespace dedicado, independiente del providers array

#### 5. Quest XP muestra "35.0000000" (decimales)
- **Commit**: ac10dc3
- **Causa raíz**: Columna `reward_amount` en PostgreSQL es NUMERIC → pg driver retorna string `"35.0000000"` → `toLocaleString()` en string no formatea
- **Fix**: `parseInt(dbQuest.reward_amount)` en `transformQuest()` + `parseInt(xp_reward)` en admin create/update

#### 6. Quest completion retorna 400 "Failed to complete quest"
- **Commit**: ac10dc3
- **Causa raíz**: El string `"35.0000000"` se pasaba a INSERT en columna INTEGER `xp_earned` → PostgreSQL rechaza el cast → catch → return null → 400
- **Fix**: `parseInt(xpEarned)` en `Quest.complete()` antes del INSERT

#### 7. Quest completion no recalcula nivel en DB
- **Commit**: ac10dc3
- **Causa raíz**: `Quest.complete()` solo hacía `SET bricks = bricks + XP` sin actualizar `level`. Solo `processTap()` recalculaba nivel
- **Fix**: Después de sumar bricks, recalcula nivel con `calculateLevelFromXp()`, respeta cap level 3 para free users, actualiza en DB

#### 8. Quests dan demasiada XP (una quest sube 5 niveles)
- **Commit**: ac10dc3
- **Causa raíz**: Defaults hardcodeados: follow=500, like=300, retweet=800. Level 1→2 solo requiere 100 XP
- **Fix**: Nuevos defaults: follow=50, like=25, retweet=50, discord=50, telegram=50

### SAFETY NET: Auto-heal de niveles
- **Archivo**: `backend/src/routes/game.js` - endpoint `/game/progress`
- Al cargar progreso, recalcula nivel desde bricks
- Si el nivel en DB no coincide → lo corrige automáticamente
- Sana usuarios existentes con niveles desincronizados por el bug anterior

### COMMITS ESTA SESIÓN

| Commit | Descripción |
|--------|-------------|
| d771427 | fix: referrals showing 3 for all users + quest XP not updating level |
| 6e467b0 | fix: wallet detection - Trust Wallet duplicates + MetaMask/Phantom selector |
| ac10dc3 | fix: quest XP bugs - level recalc, float parsing, lower defaults |

### ARCHIVOS MODIFICADOS

```
src/pyramid-meme-empire.jsx          - Referrals display fix, loadProgress after quest, wallet detection rewrite
backend/src/models/Quest.js          - parseInt reward_amount, level recalc in complete(), lower XP defaults
backend/src/routes/quests.js         - Pass isPremium to Quest.complete()
backend/src/routes/admin.js          - parseInt xp_reward in create/update quest
backend/src/routes/game.js           - Auto-heal stale levels in /game/progress
```

### QUEST XP FLOW (CORRECTO AHORA)

```
1. Frontend: completeQuest(questId) → POST /api/quests/complete
2. Backend: Quest.complete(userId, questId, xpReward, isPremium)
   a. parseInt(xpReward) → safe integer
   b. INSERT quest_completions (xp_earned as INTEGER)
   c. UPDATE game_progress SET bricks = bricks + xp
   d. SELECT bricks → calculateLevelFromXp(newBricks)
   e. Apply FREE_USER_MAX_LEVEL cap (level 3)
   f. UPDATE game_progress SET level = newLevel
3. Frontend: await loadProgress() → refreshes level, XP bar, bricks
4. Frontend: showNotification("+{xp} XP!")
```

### WALLET DETECTION FLOW (CORRECTO AHORA)

```
detectWallets():
1. Check window.ethereum.providers[] array
   - Detect Trust Wallet (isTrust/isTrustWallet) → "Trust Wallet 🛡️"
   - Detect MetaMask (isMetaMask && !isPhantom) → "MetaMask 🦊"
   - Detect Phantom (isPhantom) → "Phantom 👻"
2. ALWAYS check dedicated namespaces (even if providers found):
   - window.phantom?.ethereum → "Phantom 👻" (if not already added)
3. Fallback: check window.ethereum flags
   - isTrust → Trust Wallet
   - isMetaMask && !isPhantom && !isTrust → MetaMask
   - isPhantom → Phantom
4. Final fallback: window.ethereum → "Wallet 💳"
5. Deduplication via Set (no duplicate names)
6. If wallets > 1 → show selection modal
```

### PENDIENTES

1. ⬜ Progress bars visuales para milestone quests
2. ⬜ Daily quests con reset
3. ⬜ Quest rewards en $KAMUN tokens
4. ⬜ Telegram OAuth
5. ✅ ~~Crear cuentas sociales reales~~ - URLs actualizadas a @tapkamunfun / @tapkamun
6. ✅ ~~Actualizar URLs en quests con enlaces reales~~ - Done en f1e7701

---

## SESIÓN 2026-02-12 - QUEST VERIFICATION TYPES + ADMIN EDIT FIXES

### BUGS ENCONTRADOS Y ARREGLADOS

#### 1. Admin quest edit - metadata double-SET
- **Commit**: 55ef3cf
- **Causa raíz**: Al editar partner quests, `requirement_metadata` se seteaba dos veces (una para external_url, otra para partner_api_config). PostgreSQL last-write-wins perdía la URL
- **Fix**: Merge en una sola operación. También `parseInt(reward_amount)` en admin GET para evitar "35.0000000" en el form de edición

#### 2. Quest verification types incorrectos
- **Commit**: 65f5ca4
- **Causa raíz**: `transformQuest()` clasificaba todas las quests como 'manual' (GO+VERIFY). Game quests (tap_count, level, brick, stack, purchase) deberían ser 'internal' (CLAIM only)
- **Fix**:
  - `transformQuest`: classify tap_count, purchase, brick, stack, level as 'internal'
  - `canComplete`: add purchase handler (checks transactions table)
  - `canComplete`: use `total_bricks_earned` for brick/stack quests
  - `getUserProgress`: query total_bricks_earned and purchase count
  - Frontend: use `verification_method` to decide GO+VERIFY vs CLAIM button
  - Migration: referral quest now requires 3 verified referrals, rewards 450 XP

### ARCHIVOS MODIFICADOS

```
backend/src/models/Quest.js    - transformQuest classification, canComplete handlers, getUserProgress
backend/src/routes/admin.js    - metadata merge fix, parseInt reward_amount in GET
backend/src/server.js          - migration for referral quest requirement
src/pyramid-meme-empire.jsx   - CLAIM vs GO+VERIFY button logic
```

### COMMITS ESTA SESIÓN

| Commit | Descripción |
|--------|-------------|
| 55ef3cf | fix: admin quest edit - metadata double-SET + reward_amount float |
| 65f5ca4 | fix: quest verification types - auto-verify for game/milestone quests, require 3 referrals |

---

## SESIÓN 2026-02-16 - GALXE, MOBILE FIX, SHARE CARDS, PREMIUM TAP FIX

### FEATURES IMPLEMENTADAS

#### 1. Galxe Integration
- **Commits**: 44b6d0e, 31b1348, 25347a4
- Added Galxe domains to CORS allowed origins
- Updated Galxe config docs: `$address` placeholder, success expressions return `1`/`0` instead of boolean
- Public API endpoints ready for Galxe credential verification

#### 2. Share Card System
- **Commits**: f1e7701, 322d210, 639ef16, 0c9957f
- Canvas-rendered 600x800 PNG share cards
- 3 background images (webp) in `/public/images/share-cards/`
- Customizable: background selection, color theme, toggle stats visibility
- Share options: X (Twitter), Telegram, Download PNG, Copy Link
- Modal with live preview before sharing
- Fix: await image load before canvas export (was rendering black)
- Fix: use webp format for smaller file sizes

#### 3. Quest Seed URLs Updated
- **Commit**: f1e7701
- Social quest URLs updated to real accounts: @tapkamunfun (Twitter), @tapkamun (Telegram)
- Added discord_join quest with real invite link

### BUGS ENCONTRADOS Y ARREGLADOS

#### 1. Mobile tap lag and double-tap zoom
- **Commit**: 1bf09d4
- **Causa raíz**: Too many particles (unlimited) + no cleanup + double-tap zoom on mobile
- **Fix**:
  - Cap particles at 20 max, cleanup after 1.5s (was 3.5s)
  - Throttle taps at 50ms minimum interval
  - Prevent double-tap zoom via `touch-action: manipulation`, viewport meta `user-scalable=no`, `onTouchEnd preventDefault`
  - `will-change: transform` hint for particle GPU compositing

#### 2. Quest progress tracking and reward values
- **Commit**: bf18af8
- **Causa raíz**: Migration targeted wrong requirement_type ('referral_milestone' vs actual 'referral')
- **Fix**:
  - Target both 'referral_milestone' and 'referral' in migration
  - Set correct XP rewards: Stack 100=200 XP, Stack 1000=1000 XP, Invite=450 XP
  - Add tap_count and referral to XP_REWARDS fallback map
  - Reload quests when switching to Quests tab (progress was stale)
  - `parseInt(requirement_value)` in transformQuest (NUMERIC column safety)

#### 3. Quest edit bugs — null-safety, missing fields, ghost defaults
- **Commit**: 91f2246
- **Causa raíz**: `transformQuest` falsy-or chains (`|| defaultValue`) treated `0` as falsy, losing valid zero values. Admin edit modal missing fields for game/referral quests. Partner quests always sent ghost boost defaults (20%/30d)
- **Fix**:
  - transformQuest: use explicit null checks instead of `||` for reward_amount and requirement_value
  - PUT endpoint: accept requirement_value, store null for cleared xp_reward, parseInt sort_order
  - Edit modal: add Target Value field for game/referral quests, add Reward Type selector for partner quests
  - Only send boost fields when reward type is 'boost'

#### 4. Share card black image
- **Commits**: 322d210, 639ef16
- **Causa raíz**: Canvas `drawImage()` called before background image loaded → rendered black
- **Fix**: Wrap in `img.onload` promise, await before canvas export. Use webp for smaller size

#### 5. CRITICAL: Premium/BP users hit cooldown after ~120 taps
- **Commit**: d06743d
- **Causa raíz**: `tapRateLimit` middleware in `auth.js` capped premium at 120 taps/min. Battle Pass wasn't even checked — used free user limit of 30 taps/min
- **Fix**:
  - `tapRateLimit`: Premium and BP `return next()` immediately (full bypass, no rate limit)
  - Free user limit increased from 30 to 60 taps/min
  - Frontend: `TAP_THROTTLE` now dynamic — 0ms for premium/BP, 50ms for free users
- **Note**: `GameProgress.processTap` was already correct (no cooldown/energy for premium/BP). Bug was only in the middleware rate limiter

### COMMITS ESTA SESIÓN

| Commit | Descripción |
|--------|-------------|
| 44b6d0e | fix: add Galxe domains to CORS allowed origins |
| 31b1348 | docs: update Galxe config to use $address placeholder |
| 25347a4 | docs: update Galxe success expressions to return 1/0 instead of boolean |
| 1bf09d4 | fix: mobile tap lag and double-tap zoom |
| bf18af8 | fix: quest progress tracking and reward values |
| 91f2246 | fix: quest edit bugs — null-safety, missing fields, ghost defaults |
| f1e7701 | feat: add share card system + update quest seed URLs to tapkamun accounts |
| 322d210 | fix: use webp format for share card backgrounds |
| 639ef16 | fix: share card black image — await image load before canvas export |
| 0c9957f | feat: add share card background images (webp) |
| d06743d | fix: premium/BP users no longer hit tap rate limit after ~120 taps |

### ARCHIVOS MODIFICADOS

```
backend/src/server.js              - Galxe CORS origins, quest migrations
backend/src/middleware/auth.js     - tapRateLimit premium/BP bypass
backend/src/models/Quest.js        - null-safety, parseInt, XP_REWARDS map
backend/src/routes/admin.js        - quest edit field fixes
backend/src/config/schema.sql      - quest seed URLs updated
admin/src/components/QuestManager.jsx - edit modal: target value, reward type
src/pyramid-meme-empire.jsx        - share cards, mobile tap fix, throttle, quest reload
index.html                         - viewport meta user-scalable=no
public/images/share-cards/         - card-1.webp, card-2.webp, card-3.webp
```

### TAP RATE LIMITING (DISEÑO FINAL)

```
FREE users:
  - Backend: 60 taps/min rate limit
  - Backend: 2s cooldown between taps (processTap)
  - Backend: energy system (100 max, -1 per tap)
  - Frontend: 50ms throttle

PREMIUM users:
  - Backend: NO rate limit (bypass middleware)
  - Backend: NO cooldown (processTap skips)
  - Backend: unlimited energy
  - Frontend: 0ms throttle

BATTLE PASS users:
  - Backend: NO rate limit (bypass middleware)
  - Backend: NO cooldown (processTap skips)
  - Backend: unlimited energy, X5 boost, +10% XP
  - Frontend: 0ms throttle
```

### PENDIENTES ACTUALIZADOS

1. ⬜ Progress bars visuales para milestone quests
2. ⬜ Daily quests con reset
3. ⬜ Quest rewards en $KAMUN tokens
4. ⬜ Telegram OAuth
5. ⬜ Marketing y lanzamiento oficial

---

## SESIÓN 2026-02-16 (Parte 2) - SECURITY AUDIT COMPLETA

### Commit: 70710d6

### VULNERABILIDADES ENCONTRADAS Y CORREGIDAS

#### CRITICAL

1. **RCE via `new Function(successExpr)` en quests.js**
   - Partner quest success expressions usaban `new Function()` (equivalente a `eval()`)
   - Admin con quest maliciosa = ejecución de código arbitrario en el servidor
   - **Fix**: Reemplazado con parser seguro que solo acepta `data.field === value`

2. **`/shop/activate` — compras gratis sin pago USDC**
   - Endpoint "demo" estaba activo en producción
   - Cualquier usuario autenticado podía obtener Battle Pass/Premium gratis
   - **Fix**: `if (NODE_ENV === 'production') return 403`

3. **`/api/diagnostics/*` — 3 endpoints sin autenticación**
   - `/api/diagnostics/quests-sample` — exponía schema de quests
   - `/api/diagnostics/tables` — exponía schema completo de la DB
   - `/api/diagnostics/init-quests` — POST público que reinicializaba tablas
   - **Fix**: Eliminados completamente

4. **`/api/admin/db-check` — schema DB expuesto sin auth**
   - Exponía nombres de todas las tablas y columnas (information_schema)
   - **Fix**: Agregado `adminAuth` middleware

5. **`/api/test-body` — debug endpoint público**
   - **Fix**: Eliminado

#### HIGH

6. **POST body logging en producción**
   - `console.log('Body:', JSON.stringify(req.body))` en CADA POST request
   - Logueaba passwords de admin, wallet signatures, txHashes en Railway logs
   - **Fix**: Solo logea body en development

7. **Sin rate limiting en auth, shop, quests, oauth**
   - Endpoints críticos sin protección contra brute force/spam
   - **Fix**: `express-rate-limit` por ruta:
     * auth: 10/min
     * admin login: 5/min
     * shop: 10/min
     * quests: 20/min
     * oauth: 10/min
     * tap: ya tenía su propio rate limiter

8. **Admin password — plain text comparison**
   - Vulnerable a timing attacks
   - **Fix**: `crypto.timingSafeEqual` con buffers de igual longitud

9. **OAuth open redirect**
   - `origin` query param se usaba como redirect sin validar
   - Attacker podía redirigir a `https://evil.com` con username en URL
   - **Fix**: Whitelist de orígenes permitidos (`sanitizeOrigin()`)

10. **Sin security headers**
    - No helmet.js, sin X-Content-Type-Options, X-Frame-Options, etc.
    - **Fix**: `helmet()` middleware con CSP deshabilitado (API-only)

#### MEDIUM

11. **`express.json()` sin límite de tamaño**
    - Default 100kb, permite payloads grandes
    - **Fix**: `{ limit: '10kb' }`

12. **Admin XP grant sin cap máximo**
    - Admin (o atacante con JWT robado) podía dar 999,999,999 XP
    - **Fix**: Max 1,000,000 por grant

13. **Error responses leaking internals**
    - `receivedBody`, `tablesStatus`, `errorType`, `error.stack` en responses
    - **Fix**: Mensajes genéricos en producción

### LO QUE YA ESTABA BIEN

- **SQL Injection**: Todas las queries usan parameterized queries (`$1`, `$2`) — seguro
- **Payment verification**: Anti-replay txHash, sender check, amount check, USDC contract check — sólido
- **JWT auth**: Tokens expiran (7d user, 8h admin), middleware verifica firma
- **Admin routes**: `router.use(adminAuth)` protege todas las rutas post-login
- **Quest completion**: Verifica `isCompleted` antes de dar XP — no se puede duplicar
- **CORS**: Whitelist explícita, no wildcard en producción (excepto `/api/public/*` que es intencional)
- **Wallet auth**: Nonce + signature verification con ethers.js — correcto
- **Boost downgrade**: No se puede comprar X2 si X5 activo — validado

### DEPENDENCIAS NUEVAS

```json
"helmet": "^8.x",
"express-rate-limit": "^7.x"
```

### RATE LIMITING FINAL (TODOS LOS ENDPOINTS)

```
/api/auth/*          → 10 req/min (por IP)
/api/admin/login     → 5 req/min (por IP, extra restrictivo)
/api/admin/*         → Sin rate limit adicional (ya requiere adminAuth)
/api/shop/*          → 10 req/min (por user)
/api/quests/*        → 20 req/min (por user)
/api/oauth/*         → 10 req/min (por user)
/api/game/tap        → FREE: 60/min, PREMIUM/BP: bypass (custom middleware)
/api/public/*        → 60 req/min por IP (ya tenía su propio)
```

### ENV VARS A VERIFICAR EN RAILWAY

| Variable | Estado | Acción requerida |
|----------|--------|-----------------|
| `JWT_SECRET` | ⚠️ VERIFICAR | Debe ser 32+ chars aleatorio, NO el default |
| `ADMIN_PASSWORD` | ⚠️ VERIFICAR | Mínimo 16 chars con símbolos |
| `NODE_ENV` | ⚠️ VERIFICAR | DEBE ser `production` (bloquea /activate y body logging) |
| `SHOP_WALLET_ADDRESS` | ✅ | Ya configurado |
| `BASE_RPC_URL` | ⚠️ RECOMENDADO | Usar RPC privado (Alchemy/Infura) en vez del público |

### ARCHIVOS MODIFICADOS

```
backend/package.json               - +helmet, +express-rate-limit
backend/src/server.js              - helmet, rate limiters, remove diagnostics, body log redact, json limit
backend/src/routes/quests.js       - safe expression parser (no new Function), remove debug logs, clean errors
backend/src/routes/shop.js         - /activate blocked in production
backend/src/routes/admin.js        - db-check auth, timingSafeEqual, XP cap
backend/src/routes/oauth.js        - sanitizeOrigin whitelist
```

### RECOMENDACIONES FUTURAS (NO implementadas)

1. ⬜ **Redis** para nonces y rate limiting (en vez de in-memory Maps) — resiste restarts/scaling
2. ⬜ **ADMIN_JWT_SECRET** separado del user JWT_SECRET
3. ⬜ **2 confirmaciones** mínimas en paymentService (actualmente 1)
4. ⬜ **Bot detection** — detectar patrones de tap con intervalos exactos
5. ⬜ **Audit log table** — registrar eventos de seguridad en DB
6. ⬜ **SSL certificate validation** en DB connection (`rejectUnauthorized: true` + CA cert)

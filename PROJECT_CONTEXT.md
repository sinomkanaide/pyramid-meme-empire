# PYRAMID MEME EMPIRE - Project Context

> Last Updated: 2026-02-05
> Status: **Production Ready** with Quest System Working

---

## A. RESUMEN EJECUTIVO

### Estado Actual
- **Frontend**: Deployed en Vercel, funcionando
- **Backend**: Deployed en Railway, funcionando
- **Database**: PostgreSQL en Railway, funcionando
- **Quest System**: ✅ FUNCIONANDO (GO abre link, VERIFY otorga puntos)

### Ultimo Commit
```
ff730fb - Update quests-sample endpoint to show transformed data
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
| Multi-wallet | ✅ | MetaMask, Phantom supported |

---

## B. ARQUITECTURA ACTUAL

### URLs de Produccion
```
Frontend:  https://pyramid-meme-empire.vercel.app
Backend:   https://pyramid-meme-empire-production.up.railway.app
Health:    https://pyramid-meme-empire-production.up.railway.app/health
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
VITE_API_URL=https://pyramid-meme-empire-production.up.railway.app
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
1. Follow on X        - 500 XP  - twitter_follow
2. Like Latest Post   - 300 XP  - twitter_like
3. Retweet           - 800 XP  - twitter_retweet
4. Join Discord      - 500 XP  - discord_join
5. Join Telegram     - 500 XP  - telegram_join

Partner Quests:
6. KiiChain Testnet  - 3000 XP - partner_quest

Milestone Quests (verification_method: 'internal'):
7. Reach Level 10    - 2000 XP - level_milestone
8. Invite 5 Friends  - 2500 XP - referral_milestone
```

### 3. Multi-wallet Support
- MetaMask (prioritario)
- Phantom (detectado correctamente)
- Otros wallets EVM compatibles

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
7. 📋 Quest rewards en PME tokens (no solo XP)

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
curl -s -k https://pyramid-meme-empire-production.up.railway.app/health

# Ver estado de tablas
curl -s -k https://pyramid-meme-empire-production.up.railway.app/api/diagnostics/tables

# Ver quests transformadas
curl -s -k https://pyramid-meme-empire-production.up.railway.app/api/diagnostics/quests-sample

# Test body parsing
curl -s -k -X POST "https://pyramid-meme-empire-production.up.railway.app/api/test-body" \
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

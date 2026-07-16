// ============================================================================
// GROOM CAT — ESTILOS DEL MODO PRINCIPAL (prefijo gcm-)
// Se inyectan una sola vez desde GroomCatStage. No chocan con el CSS del juego.
// ============================================================================
export const GCM_CSS = `
.gcm-stage {
  position: relative; width: 100%;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 6px 0;
}

.gcm-combo {
  font-weight: 800; letter-spacing: 1px; font-size: 14px; color: #ffcf33;
  text-shadow: 0 0 10px rgba(255,207,51,.5); animation: gcm-pop .2s ease-out;
}

.gcm-riskbar-wrap { display: flex; align-items: center; gap: 8px; width: min(80%, 320px); }
.gcm-riskbar { flex: 1; height: 8px; border-radius: 5px; background: #26264a; overflow: hidden; }
.gcm-riskfill { height: 100%; transition: width .15s, background .3s; }
.gcm-risklabel { font-size: 11px; font-weight: 700; min-width: 84px; text-align: right; }

.gcm-cat-wrap {
  position: relative; height: min(360px, 46vh);
  display: flex; align-items: center; justify-content: center;
  /* En desktop el mouse se vuelve una peinilla 🪮 sobre el gato.
     Si el navegador no soporta el cursor-emoji, cae a pointer. */
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='42' height='42'%3E%3Ctext y='32' font-size='30'%3E🪮%3C/text%3E%3C/svg%3E") 10 30, pointer;
}
.gcm-cat {
  height: min(340px, 44vh); image-rendering: pixelated; pointer-events: none;
  filter: drop-shadow(0 6px 16px rgba(0,0,0,.5)); transition: transform .15s;
  position: relative; z-index: 1;
}

/* Aura dorada exclusiva del Battle Pass */
.gcm-aura {
  position: absolute; width: 78%; height: 78%; border-radius: 50%; z-index: 0;
  background: radial-gradient(circle, rgba(255,215,0,.55), rgba(255,190,0,.16) 55%, transparent 72%);
  filter: blur(6px); pointer-events: none;
  animation: gcm-aura-pulse 2s ease-in-out infinite;
}
@keyframes gcm-aura-pulse {
  0%,100% { transform: scale(.92); opacity: .7 }
  50% { transform: scale(1.08); opacity: 1 }
}
.gcm-cat.gcm-gold {
  filter: drop-shadow(0 0 9px rgba(255,215,0,.85)) drop-shadow(0 0 20px rgba(255,180,0,.5)) drop-shadow(0 6px 16px rgba(0,0,0,.5));
}

/* Peinilla que baja en cada peinada */
.gcm-comb {
  position: absolute; top: 18px; right: 20%; font-size: 34px;
  pointer-events: none; filter: drop-shadow(0 3px 4px rgba(0,0,0,.5)); z-index: 3;
}
.gcm-comb img { width: 42px; }
.gcm-comb-swipe { animation: gcm-swipe .3s ease-out; }
@keyframes gcm-swipe {
  0% { transform: translateY(-10px) rotate(-14deg) }
  55% { transform: translateY(52px) rotate(10deg) }
  100% { transform: translateY(0) rotate(0) }
}

/* Pelos que saltan al peinar — tufos amarillos (fallback sin PNG) */
.gcm-fur {
  position: absolute; top: 42%; height: 3px; border-radius: 3px;
  background: linear-gradient(90deg, #ffd21a, #f0a500);
  transform: rotate(var(--rot, 0deg)); pointer-events: none;
  animation: gcm-fur-fly 1s ease-out forwards; z-index: 2;
}
.gcm-fur-img {
  position: absolute; top: 42%; width: 16px; pointer-events: none;
  animation: gcm-fur-fly 1s ease-out forwards; z-index: 2;
}
@keyframes gcm-fur-fly {
  to { transform: translate(var(--drift, 20px), 74px) rotate(200deg); opacity: 0; }
}
.gcm-annoyed { animation: gcm-twitch .6s infinite; }
.gcm-turning { animation: gcm-twitch .22s infinite; }
@keyframes gcm-twitch { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }

/* "te come": zoom agresivo del gato hacia el jugador (no reflowa, solo transform) */
.gcm-zoom .gcm-cat { transform: scale(var(--gcm-zoom, 3.2)); animation: none; }
.gcm-shake { animation: gcm-shake .9s cubic-bezier(.36,.07,.19,.97); }
@keyframes gcm-shake {
  10%,90%{transform:translate(-2px,1px)} 20%,80%{transform:translate(4px,-2px)}
  30%,50%,70%{transform:translate(-6px,3px)} 40%,60%{transform:translate(6px,-3px)}
}
.gcm-chomp {
  position: absolute; bottom: 6px; left: 0; width: 100%; text-align: center;
  font-size: 24px; font-weight: 900; color: #ff2d55;
  text-shadow: 0 0 12px rgba(255,45,85,.85); animation: gcm-pop .3s ease-out; z-index: 2;
}
@keyframes gcm-pop { from{transform:scale(.3);opacity:0} to{transform:scale(1);opacity:1} }

.gcm-nap { font-weight: 800; color: #ffd700; font-variant-numeric: tabular-nums; font-size: 15px; }
`;

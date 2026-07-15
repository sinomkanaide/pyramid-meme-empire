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
  position: relative; height: 240px;
  display: flex; align-items: center; justify-content: center;
}
.gcm-cat {
  height: 220px; image-rendering: pixelated; pointer-events: none;
  filter: drop-shadow(0 6px 16px rgba(0,0,0,.5)); transition: transform .15s;
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

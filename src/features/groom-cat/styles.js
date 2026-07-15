// ============================================================================
// GROOM CAT — ESTILOS
// Se inyectan como <style> desde initGroomCat(). Prefijo gc- en todo para
// no chocar jamás con las clases del juego.
// ============================================================================
export const GC_CSS = `
.gc-fab {
  position: fixed; right: 14px; bottom: 92px; z-index: 9000;
  width: 56px; height: 56px; border-radius: 50%;
  border: 2px solid #FFD700; background: #1a1a2e; color: #fff;
  font-size: 26px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.5);
  transition: transform .15s;
}
.gc-fab:active { transform: scale(.9); }

.gc-overlay {
  position: fixed; inset: 0; z-index: 9500;
  background: rgba(8,8,18,.92); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  animation: gc-fadein .2s ease-out;
}
@keyframes gc-fadein { from { opacity: 0 } to { opacity: 1 } }

.gc-panel {
  width: min(92vw, 420px); padding: 16px; border-radius: 16px;
  background: #12122a; border: 1px solid rgba(255,215,0,.35);
  display: flex; flex-direction: column; gap: 12px;
  font-family: inherit; color: #fff;
}

.gc-header { display: flex; justify-content: space-between; align-items: center; }
.gc-title { font-weight: 800; letter-spacing: 1px; color: #FFD700; }
.gc-close { background: none; border: none; color: #999; font-size: 20px; cursor: pointer; }

.gc-points { font-size: 22px; font-weight: 700; }
.gc-session { margin-left: 8px; font-size: 13px; color: #00e676; }

.gc-riskbar-wrap { display: flex; align-items: center; gap: 8px; }
.gc-riskbar { flex: 1; height: 10px; border-radius: 6px; background: #26264a; overflow: hidden; }
.gc-riskfill { height: 100%; transition: width .15s, background .3s; }
.gc-risklabel { font-size: 12px; font-weight: 700; min-width: 96px; text-align: right; }

.gc-cat-area {
  position: relative; height: 240px; border-radius: 12px;
  background: radial-gradient(circle at 50% 60%, #1e1e3f, #0d0d20);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; user-select: none; -webkit-user-select: none;
  overflow: hidden; touch-action: manipulation;
}
.gc-cat { height: 170px; image-rendering: pixelated; pointer-events: none; transition: transform .2s; }
.gc-annoyed { animation: gc-twitch .6s infinite; }
.gc-turning { animation: gc-twitch .25s infinite; }
@keyframes gc-twitch { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-2px) } 75% { transform: translateX(2px) } }

.gc-zoom .gc-cat { transform: scale(var(--gc-zoom, 3.2)); animation: none; }
.gc-shake { animation: gc-shakescreen var(--gc-shake-ms, 900ms) cubic-bezier(.36,.07,.19,.97); }
@keyframes gc-shakescreen {
  10%, 90% { transform: translate(-2px, 1px) } 20%, 80% { transform: translate(4px, -2px) }
  30%, 50%, 70% { transform: translate(-6px, 3px) } 40%, 60% { transform: translate(6px, -3px) }
}
.gc-chomp {
  position: absolute; bottom: 14px; width: 100%; text-align: center;
  font-size: 26px; font-weight: 900; color: #ff2d55;
  text-shadow: 0 0 12px rgba(255,45,85,.8); animation: gc-pop .3s ease-out;
}
@keyframes gc-pop { from { transform: scale(.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }

.gc-comb {
  position: absolute; top: 24px; right: 22%; font-size: 34px;
  pointer-events: none; filter: drop-shadow(0 3px 4px rgba(0,0,0,.5));
}
.gc-comb img { width: 40px; }
.gc-comb-swipe { animation: gc-swipe .35s ease-out; }
@keyframes gc-swipe {
  0% { transform: translateY(-8px) rotate(-12deg) } 60% { transform: translateY(46px) rotate(8deg) } 100% { transform: translateY(0) rotate(0) }
}

.gc-fur {
  position: absolute; top: 45%; font-size: 15px; pointer-events: none;
  animation: gc-fur-fly 1.1s ease-out forwards;
}
@keyframes gc-fur-fly {
  to { transform: translate(var(--drift, 20px), 70px) rotate(160deg); opacity: 0; }
}

.gc-rest { text-align: center; display: flex; flex-direction: column; gap: 6px; }
.gc-rest-label { color: #9aa; }
.gc-rest-timer { font-size: 34px; font-weight: 900; color: #FFD700; font-variant-numeric: tabular-nums; }
.gc-rest-hint { font-size: 12px; color: #7a7a9a; }

.gc-btn {
  padding: 12px; border-radius: 10px; border: none; cursor: pointer;
  font-weight: 800; font-size: 14px; letter-spacing: .5px;
}
.gc-btn-drop { background: linear-gradient(135deg, #FFD700, #ff9500); color: #1a1a2e; }
.gc-btn-drop:active { transform: scale(.97); }
.gc-btn-secondary { background: #26264a; color: #ccd; margin-top: 4px; }
`;

// ============================================================================
// GROOM CAT — PERSISTENCIA
// Todo se lee con `?? default`. Un save viejo (o inexistente, o corrupto)
// funciona sin migración y sin crashear.
// ============================================================================
import { GROOM_CAT_CONFIG as CFG } from './config';

const DEFAULTS = Object.freeze({
  points: 0,          // furballs acumulados (se conservan aunque te coman)
  catRestUntil: 0,    // epoch ms — 0 significa "no está descansando"
  eatenCount: 0,      // cuántas veces te ha comido (para escalar el descanso)
  lastEatenAt: 0,     // epoch ms de la última vez que te comió
});

export function loadCatState() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(CFG.STORAGE_KEY));
  } catch {
    raw = null; // JSON corrupto → arrancamos de defaults, sin drama
  }
  const s = raw ?? {};
  return {
    points: Number(s.points ?? DEFAULTS.points) || 0,
    catRestUntil: Number(s.catRestUntil ?? DEFAULTS.catRestUntil) || 0,
    eatenCount: Number(s.eatenCount ?? DEFAULTS.eatenCount) || 0,
    lastEatenAt: Number(s.lastEatenAt ?? DEFAULTS.lastEatenAt) || 0,
  };
}

export function saveCatState(state) {
  try {
    localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage lleno o bloqueado: el juego sigue, solo no persiste
  }
}

// ¿Está el gato descansando AHORA? Se compara contra Date.now() en cada
// render — nunca un setInterval de una hora. Sobrevive a cerrar la app.
export function isResting(state, now = Date.now()) {
  return (state.catRestUntil ?? 0) > now;
}

// Duración del próximo descanso según cuántas veces te ha comido.
// Si pasaron 24h desde la última vez, el contador vuelve a cero.
export function nextRestDuration(state, now = Date.now()) {
  const effectiveCount = effectiveEatenCount(state, now);
  const durations = CFG.REST_DURATIONS_MS;
  const idx = Math.min(effectiveCount, durations.length - 1);
  return durations[idx];
}

export function effectiveEatenCount(state, now = Date.now()) {
  const last = state.lastEatenAt ?? 0;
  if (last > 0 && now - last >= CFG.EATEN_COUNT_RESET_MS) return 0;
  return state.eatenCount ?? 0;
}

// ============================================================================
// GROOM CAT — CONFIG ÚNICO
// Todos los números tuneables viven AQUÍ. No hay magic numbers en el resto
// del módulo. Cambia, guarda, recarga.
// ============================================================================

export const FEATURES = {
  // Apágalo y el módulo no monta nada, no lee nada, no ejecuta nada.
  GROOM_CAT: true,
};

export const GROOM_CAT_CONFIG = {
  // ---------- MEDIDOR DE ENOJO / RIESGO ----------
  // El "riesgo" es un medidor 0→1 que sube parejo con cada tap. El gato NO
  // puede comerte hasta llegar a la zona "turning" (EATEN_START_RISK): así
  // SIEMPRE ves la escalada calm → annoyed → turning antes de la mordida.
  SAFE_TAPS: 5,              // primeros N taps sin que suba el medidor
  RISK_PER_TAP: 0.03,        // +3% de medidor por tap después de los seguros
  RISK_CAP: 1.0,             // tope del medidor (100%)
  CALM_AFTER_MS: 2500,       // ms sin tapear antes de que el gato empiece a calmarse
  CALM_DECAY_PER_SEC: 0.04,  // cuánto baja el medidor por segundo al calmarse
  CALM_FLOOR: 0,             // hasta dónde puede bajar al calmarse

  // ---------- ESTADOS VISUALES (umbrales del medidor) ----------
  ANNOYED_AT: 0.40,          // orejas atrás — telegrafía el peligro
  TURNING_AT: 0.72,          // ya se está dando vuelta — ponte nervioso

  // ---------- MORDIDA ----------
  EATEN_START_RISK: 0.72,    // el gato SOLO puede comerte a partir de aquí (= turning)
  EATEN_MAX_CHANCE: 0.5,     // prob. de mordida por tap con el medidor al máximo (rampa 0→esto)

  // ---------- PUNTOS ----------
  POINTS_PER_TAP: 1,

  // ---------- DESCANSO (cooldown escalonado) ----------
  // índice = número de veces comido (1ra, 2da, 3ra+). El último valor se
  // repite para todas las siguientes.
  REST_DURATIONS_MS: [
    15 * 60 * 1000,  // 1ra vez: 15 min
    30 * 60 * 1000,  // 2da vez: 30 min
    60 * 60 * 1000,  // 3ra en adelante: 1 hora
  ],
  EATEN_COUNT_RESET_MS: 24 * 60 * 60 * 1000, // 24h sin ser comido → contador a 0

  // ---------- ASSETS ----------
  // Los webp van en public/cat/ (Vite los sirve desde la raíz: /cat/calm.webp)
  ASSET_BASE: '/cat',
  SPRITES: {
    calm: 'calm.webp',
    annoyed: 'annoyed.webp',
    turning: 'turning.webp',
    eating: 'eating.webp',
    sleeping: 'sleeping.webp',
  },

  // ---------- PUNTOS DE ENGANCHE (pendientes, no bloquean) ----------
  // Cuando tengas los assets, pon la ruta y el módulo los usa solo.
  COMB_SPRITE: null,          // ej: 'comb.webp' — mientras sea null usa un emoji 🪮 (fallback)
  FUR_PARTICLE_SPRITE: null,  // ej: 'fur.webp' — mientras sea null usa partículas de texto
  SOUNDS: {
    groom: null,              // ej: '/sounds/brush.wav' — por tap
    eaten: null,              // ej: '/sounds/chomp.wav' — al perder (fuerte)
    purr: null,               // ambiente opcional
  },

  // Hook para sincronizar puntos con tu backend más adelante.
  // Recibe (pointsGanadosEnLaSesión, totalAcumulado). Déjalo null por ahora.
  onPointsAwarded: null,

  // ---------- MODO PRINCIPAL (el gato ES el juego) ----------
  // Que te coma NO bloquea la ganancia con lockout largo: solo una siesta
  // corta. La ganancia real (puntos del leaderboard) la sigue dando el backend
  // por cada tap. El riesgo real = aguantar más sin que te coma = más taps.
  MAIN_NAP_MS: 5000,          // siesta tras ser comido (ms). Corta, sin lockout de minutos.

  // ---------- FX del "te come" ----------
  EATEN_ZOOM_SCALE: 3.2,      // zoom agresivo hacia la boca
  EATEN_SHAKE_MS: 900,        // duración del temblor de pantalla
  EATEN_SEQUENCE_MS: 1800,    // duración de la secuencia explosiva antes de la siesta

  // ---------- PERSISTENCIA ----------
  STORAGE_KEY: 'pme_groomcat_v1', // namespaced, no choca con pme_token
};

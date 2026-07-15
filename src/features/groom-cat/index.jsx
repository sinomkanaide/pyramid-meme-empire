// ============================================================================
// GROOM CAT — ÚNICO PUNTO DE ENTRADA PÚBLICO (modo principal)
//
// El gato es el juego principal. Lo único que el resto del juego necesita:
//   FEATURES.GROOM_CAT   → flag; en false vuelve la pirámide clásica
//   useGroomCatMain()    → hook con la capa de riesgo/fases/combo/siesta
//   <GroomCatStage/>     → el gato como visual central (dentro de la tap-area)
//
// La ganancia real (puntos del leaderboard) la sigue dando el backend por cada
// tap: este módulo no toca puntos. Que te coma = siesta corta, sin lockout.
// ============================================================================
export { FEATURES, GROOM_CAT_CONFIG } from './config';
export { useGroomCatMain } from './useGroomCatMain';
export { default as GroomCatStage } from './GroomCatStage';

// ============================================================================
// GROOM CAT — HOOK DEL MODO PRINCIPAL
// El gato ES el juego. Este hook SOLO maneja la capa de riesgo + estado visual
// (fase, riesgo, combo, siesta). La ganancia real (puntos del leaderboard) la
// sigue otorgando el backend por cada tap — acá no se tocan puntos.
//
// Que te coma = animación explosiva + siesta CORTA (segundos). Sin lockout de
// minutos. Los puntos ganados nunca se pierden.
// ============================================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { GROOM_CAT_CONFIG as CFG } from './config';

export function useGroomCatMain() {
  const [phase, setPhase] = useState('idle');   // idle | eaten | nap
  const [risk, setRisk] = useState(0);
  const [combo, setCombo] = useState(0);
  const [combAnim, setCombAnim] = useState(0);  // trigger de la peinada (peinilla)
  const [furBits, setFurBits] = useState([]);   // pelos que saltan al peinar
  const [napUntil, setNapUntil] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());

  // Refs espejo para la lógica imperativa (evita estado obsoleto en taps rápidos)
  const phaseRef = useRef('idle');
  const riskRef = useRef(0);
  const tapsRef = useRef(0);
  const lastTapAt = useRef(0);
  const furId = useRef(0);
  const timers = useRef([]);

  const setPhaseBoth = (p) => { phaseRef.current = p; setPhase(p); };
  const setRiskBoth = (v) => { riskRef.current = v; setRisk(v); };

  // Ticker para countdown de siesta (no decide nada crítico)
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // El gato se calma si dejás de tapear
  useEffect(() => {
    const t = setInterval(() => {
      if (phaseRef.current === 'idle'
          && riskRef.current > CFG.CALM_FLOOR
          && Date.now() - lastTapAt.current >= CFG.CALM_AFTER_MS) {
        setRiskBoth(Math.max(CFG.CALM_FLOOR, riskRef.current - CFG.CALM_DECAY_PER_SEC));
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Limpiar timers pendientes al desmontar
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current = []; }, []);

  const triggerEaten = useCallback(() => {
    setPhaseBoth('eaten');
    setCombo(0);
    setRiskBoth(0);
    tapsRef.current = 0;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([80, 40, 200]); } catch { /* noop */ }
    }
    // secuencia explosiva → siesta corta → despierta en calma
    const t1 = setTimeout(() => {
      setPhaseBoth('nap');
      setNapUntil(Date.now() + CFG.MAIN_NAP_MS);
      const t2 = setTimeout(() => setPhaseBoth('idle'), CFG.MAIN_NAP_MS);
      timers.current.push(t2);
    }, CFG.EATEN_SEQUENCE_MS);
    timers.current.push(t1);
  }, []);

  // Llamar SOLO cuando un tap contó de verdad (después de que el backend/local
  // ya otorgó el punto). Así "conservás los puntos" incluso en el tap fatal.
  const onValidTap = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    lastTapAt.current = Date.now();
    setCombo((c) => c + 1);

    // FX de peinada: swipe de la peinilla + pelos que saltan
    setCombAnim((c) => c + 1);
    const id = ++furId.current;
    const bit = {
      id,
      x: 30 + Math.random() * 40,           // % horizontal dentro del gato
      drift: (Math.random() - 0.5) * 90,    // deriva px al caer
      rot: Math.floor(Math.random() * 360), // rotación inicial
      len: 7 + Math.floor(Math.random() * 9),
    };
    setFurBits((f) => [...f.slice(-16), bit]);
    const clean = setTimeout(() => setFurBits((f) => f.filter((b) => b.id !== id)), 1100);
    timers.current.push(clean);

    const n = ++tapsRef.current;
    if (n <= CFG.SAFE_TAPS) return;               // primeros taps sin riesgo
    const nr = Math.min(CFG.RISK_CAP, riskRef.current + CFG.RISK_PER_TAP);
    setRiskBoth(nr);

    // El gato solo muerde en la zona de peligro (>= EATEN_START_RISK). La
    // probabilidad rampa de 0 hasta EATEN_MAX_CHANCE al llegar al tope.
    if (nr >= CFG.EATEN_START_RISK) {
      const span = Math.max(0.0001, CFG.RISK_CAP - CFG.EATEN_START_RISK);
      const t = (nr - CFG.EATEN_START_RISK) / span;
      if (Math.random() < t * CFG.EATEN_MAX_CHANCE) triggerEaten();
    }
  }, [triggerEaten]);

  // ¿El gato está comiendo/durmiendo? → el tap principal se bloquea unos seg.
  const isBusy = useCallback(() => phaseRef.current !== 'idle', []);

  const spriteName =
    phase === 'eaten' ? 'eating'
    : phase === 'nap' ? 'sleeping'
    : risk >= CFG.TURNING_AT ? 'turning'
    : risk >= CFG.ANNOYED_AT ? 'annoyed'
    : 'calm';

  const napLeftMs = phase === 'nap' ? Math.max(0, napUntil - nowTs) : 0;

  return {
    phase, risk, combo, spriteName,
    combAnim, furBits,
    napLeftMs, napTotalMs: CFG.MAIN_NAP_MS,
    onValidTap, isBusy,
  };
}

// ============================================================================
// GROOM CAT — UI + LÓGICA DE JUEGO
// Componente autocontenido. No importa nada del juego principal.
// ============================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GROOM_CAT_CONFIG as CFG } from './config';
import {
  loadCatState, saveCatState, isResting,
  nextRestDuration, effectiveEatenCount,
} from './state';

const sprite = (name) => `${CFG.ASSET_BASE}/${CFG.SPRITES[name]}`;

// Fases de la sesión: idle (calm/annoyed/turning según riesgo),
// eaten (secuencia explosiva), resting (sleeping + countdown)
export default function GroomCatOverlay({ onClose }) {
  const [saved, setSaved] = useState(() => loadCatState());
  const [risk, setRisk] = useState(0);
  const [taps, setTaps] = useState(0);            // taps de esta sesión
  const [sessionPoints, setSessionPoints] = useState(0);
  const [phase, setPhase] = useState('idle');
  const [now, setNow] = useState(Date.now());
  const [combAnim, setCombAnim] = useState(0);    // trigger de animación de peinada
  const [furBits, setFurBits] = useState([]);     // partículas de pelo
  const lastTapAt = useRef(0);
  const furId = useRef(0);

  // Reloj de 1s: solo para countdown y calma. El bloqueo real SIEMPRE se
  // decide comparando catRestUntil vs Date.now() en render (regla #1).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // El gato se calma si dejas de tapear
  useEffect(() => {
    if (phase !== 'idle' || risk <= CFG.CALM_FLOOR) return;
    const t = setInterval(() => {
      if (Date.now() - lastTapAt.current >= CFG.CALM_AFTER_MS) {
        setRisk((r) => Math.max(CFG.CALM_FLOOR, r - CFG.CALM_DECAY_PER_SEC));
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, risk > CFG.CALM_FLOOR]);

  const resting = isResting(saved, now);

  // Si el descanso terminó mientras el overlay estaba abierto, volvemos a idle
  useEffect(() => {
    if (phase === 'resting' && !resting) {
      setPhase('idle');
      setRisk(0);
      setTaps(0);
    }
  }, [phase, resting]);

  const persist = useCallback((patch) => {
    setSaved((prev) => {
      const next = { ...prev, ...patch };
      saveCatState(next);
      return next;
    });
  }, []);

  const playSound = (key) => {
    const src = CFG.SOUNDS?.[key];
    if (!src) return; // punto de enganche: sin audio aún, no bloquea nada
    try { new Audio(src).play().catch(() => {}); } catch { /* noop */ }
  };

  const spawnFur = () => {
    const id = ++furId.current;
    const bit = {
      id,
      x: 35 + Math.random() * 30,
      drift: (Math.random() - 0.5) * 60,
      char: CFG.FUR_PARTICLE_SPRITE ? null : ['〰️', '✨', '💛'][Math.floor(Math.random() * 3)],
    };
    setFurBits((f) => [...f.slice(-14), bit]);
    setTimeout(() => setFurBits((f) => f.filter((b) => b.id !== id)), 1200);
  };

  const getsEaten = () => {
    playSound('eaten');
    setPhase('eaten');
    if (navigator.vibrate) { try { navigator.vibrate([80, 40, 200]); } catch { /* noop */ } }

    const eatenAt = Date.now();
    const count = effectiveEatenCount(saved, eatenAt) + 1;
    const restMs = nextRestDuration(saved, eatenAt);

    // Los puntos de la sesión SE CONSERVAN: ya se sumaron y persistieron en
    // handleGroomTap (incluido el tap fatal). NO tocamos `points` aquí para
    // no pisar hacia atrás ese último punto.
    persist({
      catRestUntil: eatenAt + restMs,
      eatenCount: count,
      lastEatenAt: eatenAt,
    });

    setTimeout(() => setPhase('resting'), CFG.EATEN_SEQUENCE_MS);
  };

  const handleGroomTap = (e) => {
    e?.preventDefault?.();
    if (phase !== 'idle' || resting) return;

    lastTapAt.current = Date.now();
    const newTaps = taps + 1;
    setTaps(newTaps);
    setCombAnim((c) => c + 1);
    spawnFur();
    playSound('groom');

    // Punto por tap — se persiste de inmediato para que "conservar puntos"
    // sea trivialmente cierto incluso si te come en el tap siguiente.
    const gained = CFG.POINTS_PER_TAP;
    setSessionPoints((p) => p + gained);
    const newTotal = (saved.points ?? 0) + gained;
    persist({ points: newTotal });
    if (typeof CFG.onPointsAwarded === 'function') {
      try { CFG.onPointsAwarded(gained, newTotal); } catch { /* noop */ }
    }

    // Riesgo: primeros SAFE_TAPS gratis, luego +RISK_PER_TAP con techo
    if (newTaps <= CFG.SAFE_TAPS) return;
    const newRisk = Math.min(CFG.RISK_CAP, risk + CFG.RISK_PER_TAP);
    setRisk(newRisk);

    if (Math.random() < newRisk) getsEaten();
  };

  const dropComb = () => {
    // Retirada voluntaria: conservas todo, sin castigo
    setPhase('idle');
    setRisk(0);
    setTaps(0);
    onClose();
  };

  // ---------- render ----------
  const spriteName =
    phase === 'eaten' ? 'eating'
    : (phase === 'resting' || resting) ? 'sleeping'
    : risk >= CFG.TURNING_AT ? 'turning'
    : risk >= CFG.ANNOYED_AT ? 'annoyed'
    : 'calm';

  const restLeft = Math.max(0, (saved.catRestUntil ?? 0) - now);
  const mm = String(Math.floor(restLeft / 60000)).padStart(2, '0');
  const ss = String(Math.floor((restLeft % 60000) / 1000)).padStart(2, '0');

  const dangerPct = Math.round(risk * 100);
  const barColor = risk >= CFG.TURNING_AT ? '#ff2d55' : risk >= CFG.ANNOYED_AT ? '#ff9500' : '#00e676';

  return (
    <div
      className={`gc-overlay ${phase === 'eaten' ? 'gc-shake' : ''}`}
      style={{ '--gc-zoom': CFG.EATEN_ZOOM_SCALE, '--gc-shake-ms': `${CFG.EATEN_SHAKE_MS}ms` }}
    >
      <div className="gc-panel">
        <div className="gc-header">
          <span className="gc-title">🪮 PEINAR AL GATO</span>
          <button className="gc-close" onClick={dropComb} aria-label="Cerrar">✕</button>
        </div>

        <div className="gc-points">
          🧶 {saved.points ?? 0}
          {sessionPoints > 0 && <span className="gc-session">+{sessionPoints} esta sesión</span>}
        </div>

        {phase !== 'eaten' && !resting && (
          <div className="gc-riskbar-wrap">
            <div className="gc-riskbar">
              <div className="gc-riskfill" style={{ width: `${dangerPct}%`, background: barColor }} />
            </div>
            <span className="gc-risklabel" style={{ color: barColor }}>
              {taps <= CFG.SAFE_TAPS ? 'seguro… por ahora' : `peligro ${dangerPct}%`}
            </span>
          </div>
        )}

        <div
          className={`gc-cat-area ${phase === 'eaten' ? 'gc-zoom' : ''}`}
          onClick={handleGroomTap}
          onTouchEnd={(e) => { e.preventDefault(); handleGroomTap(e); }}
        >
          <img
            className={`gc-cat gc-${spriteName}`}
            src={sprite(spriteName)}
            alt={spriteName}
            draggable={false}
          />
          {phase === 'idle' && !resting && (
            <div key={combAnim} className={combAnim ? 'gc-comb gc-comb-swipe' : 'gc-comb'}>
              {CFG.COMB_SPRITE
                ? <img src={`${CFG.ASSET_BASE}/${CFG.COMB_SPRITE}`} alt="peinilla" draggable={false} />
                : '🪮'}
            </div>
          )}
          {furBits.map((b) => (
            <span key={b.id} className="gc-fur" style={{ left: `${b.x}%`, '--drift': `${b.drift}px` }}>
              {b.char ?? <img src={`${CFG.ASSET_BASE}/${CFG.FUR_PARTICLE_SPRITE}`} alt="" width="16" />}
            </span>
          ))}
          {phase === 'eaten' && <div className="gc-chomp">¡TE COMIÓ! 😱</div>}
        </div>

        {resting ? (
          <div className="gc-rest">
            <div className="gc-rest-label">El gato está descansando…</div>
            <div className="gc-rest-timer">{mm}:{ss}</div>
            <div className="gc-rest-hint">Tus 🧶 están a salvo. El tap normal sigue funcionando.</div>
            <button className="gc-btn gc-btn-secondary" onClick={onClose}>Volver al juego</button>
          </div>
        ) : phase === 'idle' ? (
          <button className="gc-btn gc-btn-drop" onClick={dropComb}>
            🖐️ Soltar la peinilla y retirarse
          </button>
        ) : null}
      </div>
    </div>
  );
}

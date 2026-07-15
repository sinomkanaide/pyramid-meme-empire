// ============================================================================
// GROOM CAT — STAGE DEL MODO PRINCIPAL
// El gato como visual central del juego. NO maneja el tap (eso lo hace la
// tap-area del juego con handleTap); este componente solo pinta el estado
// (sprite por riesgo/fase, combo, barra de peligro, "te come", siesta) y los
// FX de peinada: la peinilla que baja y los pelos que saltan.
// ============================================================================
import React, { useEffect } from 'react';
import { GROOM_CAT_CONFIG as CFG } from './config';
import { GCM_CSS } from './stageStyles';

const sprite = (name) => `${CFG.ASSET_BASE}/${CFG.SPRITES[name]}`;

let cssInjected = false;
function ensureCss() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const s = document.createElement('style');
  s.id = 'groom-cat-main-styles';
  s.textContent = GCM_CSS;
  document.head.appendChild(s);
}

export default function GroomCatStage({ spriteName, phase, risk, combo, combAnim, furBits = [], napLeftMs }) {
  useEffect(() => { ensureCss(); }, []);

  const dangerPct = Math.round(risk * 100);
  const barColor = risk >= CFG.TURNING_AT ? '#ff2d55' : risk >= CFG.ANNOYED_AT ? '#ff9500' : '#00e676';
  const napSec = Math.ceil(napLeftMs / 1000);
  const idle = phase === 'idle';

  return (
    <div
      className={`gcm-stage ${phase === 'eaten' ? 'gcm-shake' : ''}`}
      style={{ '--gcm-zoom': CFG.EATEN_ZOOM_SCALE }}
    >
      {/* Streak multiplier — visual only (does not affect the leaderboard) */}
      {idle && combo > 0 && (
        <div className="gcm-combo">🔥 COMBO x{combo}</div>
      )}

      {/* Danger meter (only once the cat starts getting annoyed) */}
      {idle && risk > 0 && (
        <div className="gcm-riskbar-wrap">
          <div className="gcm-riskbar">
            <div className="gcm-riskfill" style={{ width: `${dangerPct}%`, background: barColor }} />
          </div>
          <span className="gcm-risklabel" style={{ color: barColor }}>DANGER {dangerPct}%</span>
        </div>
      )}

      <div className={`gcm-cat-wrap ${phase === 'eaten' ? 'gcm-zoom' : ''}`}>
        <img
          className={`gcm-cat gcm-${spriteName}`}
          src={sprite(spriteName)}
          alt={spriteName}
          draggable={false}
        />

        {/* Peinilla: baja en cada peinada. Usa PNG si hay COMB_SPRITE, si no 🪮 */}
        {idle && (
          <div key={combAnim} className={combAnim ? 'gcm-comb gcm-comb-swipe' : 'gcm-comb'}>
            {CFG.COMB_SPRITE
              ? <img src={`${CFG.ASSET_BASE}/${CFG.COMB_SPRITE}`} alt="comb" draggable={false} />
              : '🪮'}
          </div>
        )}

        {/* Pelos que saltan al peinar (PNG si hay FUR_PARTICLE_SPRITE, si no tufos CSS) */}
        {idle && furBits.map((b) => (
          CFG.FUR_PARTICLE_SPRITE ? (
            <img
              key={b.id}
              className="gcm-fur-img"
              src={`${CFG.ASSET_BASE}/${CFG.FUR_PARTICLE_SPRITE}`}
              alt=""
              style={{ left: `${b.x}%`, '--drift': `${b.drift}px`, '--rot': `${b.rot}deg` }}
            />
          ) : (
            <span
              key={b.id}
              className="gcm-fur"
              style={{ left: `${b.x}%`, width: `${b.len}px`, '--drift': `${b.drift}px`, '--rot': `${b.rot}deg` }}
            />
          )
        ))}

        {phase === 'eaten' && <div className="gcm-chomp">GOTCHA! 😱</div>}
      </div>

      {phase === 'nap' && (
        <div className="gcm-nap">😴 The cat is napping… {napSec}s</div>
      )}
    </div>
  );
}

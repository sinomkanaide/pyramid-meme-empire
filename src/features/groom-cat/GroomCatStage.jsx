// ============================================================================
// GROOM CAT — STAGE DEL MODO PRINCIPAL
// El gato como visual central del juego. NO maneja el tap (eso lo hace la
// tap-area del juego con handleTap); este componente solo pinta el estado
// (sprite por riesgo/fase, combo visual, barra de peligro, "te come", siesta).
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

export default function GroomCatStage({ spriteName, phase, risk, combo, napLeftMs }) {
  useEffect(() => { ensureCss(); }, []);

  const dangerPct = Math.round(risk * 100);
  const barColor = risk >= CFG.TURNING_AT ? '#ff2d55' : risk >= CFG.ANNOYED_AT ? '#ff9500' : '#00e676';
  const napSec = Math.ceil(napLeftMs / 1000);

  return (
    <div
      className={`gcm-stage ${phase === 'eaten' ? 'gcm-shake' : ''}`}
      style={{ '--gcm-zoom': CFG.EATEN_ZOOM_SCALE }}
    >
      {/* Multiplicador de racha — SOLO visual (no afecta el leaderboard) */}
      {phase === 'idle' && combo > 0 && (
        <div className="gcm-combo">🔥 COMBO x{combo}</div>
      )}

      {/* Barra de peligro (solo cuando ya hay riesgo acumulado) */}
      {phase !== 'eaten' && phase !== 'nap' && risk > 0 && (
        <div className="gcm-riskbar-wrap">
          <div className="gcm-riskbar">
            <div className="gcm-riskfill" style={{ width: `${dangerPct}%`, background: barColor }} />
          </div>
          <span className="gcm-risklabel" style={{ color: barColor }}>peligro {dangerPct}%</span>
        </div>
      )}

      <div className={`gcm-cat-wrap ${phase === 'eaten' ? 'gcm-zoom' : ''}`}>
        <img
          className={`gcm-cat gcm-${spriteName}`}
          src={sprite(spriteName)}
          alt={spriteName}
          draggable={false}
        />
        {phase === 'eaten' && <div className="gcm-chomp">¡TE COMIÓ! 😱</div>}
      </div>

      {phase === 'nap' && (
        <div className="gcm-nap">😴 El gato duerme… {napSec}s</div>
      )}
    </div>
  );
}

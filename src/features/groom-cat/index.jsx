// ============================================================================
// GROOM CAT — ÚNICO PUNTO DE ENTRADA PÚBLICO
//
// API pública (lo único que el resto del juego debe conocer):
//   initGroomCat()          → montar el módulo (respeta FEATURES.GROOM_CAT)
//   groomCatInterceptTap()  → true si el modo gato debe consumir el tap
//
// El módulo se monta en su propio React root sobre un <div> propio en
// <body>. No toca el árbol de React del juego, no toca su CSS, no toca
// su estado. Flag apagado ⇒ initGroomCat() retorna sin hacer nada.
// ============================================================================
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { FEATURES, GROOM_CAT_CONFIG as CFG } from './config';
import { loadCatState, isResting } from './state';
import GroomCatOverlay from './GroomCatOverlay';
import { GC_CSS } from './styles';

let overlayOpen = false; // estado consultable de forma síncrona desde handleTap

function GroomCatRoot() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => { overlayOpen = open; }, [open]);

  // refresco liviano del botón flotante (para el puntito de "descansando")
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const resting = isResting(loadCatState()); // compara catRestUntil vs Date.now()

  return (
    <>
      <button
        className="gc-fab"
        onClick={() => setOpen(true)}
        aria-label="Peinar al gato"
        title={resting ? 'El gato está descansando' : 'Peinar al gato'}
      >
        {resting ? '😴' : '🐱'}
      </button>
      {open && <GroomCatOverlay onClose={() => setOpen(false)} />}
    </>
  );
}

let mounted = false;

export function initGroomCat() {
  if (!FEATURES.GROOM_CAT) return; // flag apagado: cero ejecución
  if (mounted) return;             // idempotente (StrictMode, HMR, doble init)
  mounted = true;

  const style = document.createElement('style');
  style.id = 'groom-cat-styles';
  style.textContent = GC_CSS;
  document.head.appendChild(style);

  const host = document.createElement('div');
  host.id = 'groom-cat-root';
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<GroomCatRoot />);
}

// Para la línea delegadora en handleTap del juego principal:
// si el overlay del gato está abierto, el tap NO debe contar en el juego
// normal. (El overlay ya captura sus propios eventos; esto es el cinturón
// de seguridad explícito.)
export function groomCatInterceptTap() {
  return FEATURES.GROOM_CAT && overlayOpen;
}

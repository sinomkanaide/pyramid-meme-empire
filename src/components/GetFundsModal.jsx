import { LiFiWidget } from '@lifi/widget';
import { EthereumProvider } from '@lifi/widget-provider-ethereum';

// Robinhood Chain (4663) + USDG. Built once at module scope so the wallet
// provider/wagmi config stays stable across re-renders.
const USDG_ADDRESS = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';

const widgetConfig = {
  integrator: 'tapkamun',
  providers: [EthereumProvider()],
  // Default destination: land USDG on Robinhood Chain.
  toChain: 4663,
  toToken: USDG_ADDRESS,
  appearance: 'dark',
  variant: 'compact',
  theme: {
    container: {
      borderRadius: '16px',
    },
  },
};

export default function GetFundsModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.95)',
        zIndex: 10005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          border: '3px solid #00FF00',
          borderRadius: 20,
          padding: 20,
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 0 50px rgba(0,255,0,0.25)',
          maxHeight: '95vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 16, color: '#00FF00', fontWeight: 'bold', fontFamily: 'inherit' }}>
            GET FUNDS
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 10, color: '#bbb', lineHeight: 1.6, fontFamily: 'inherit', marginBottom: 14 }}>
          Bridge funds to <b style={{ color: '#fff' }}>Robinhood Chain</b> from any network.
          You'll pay in <b style={{ color: '#fff' }}>USDG</b> — and you also need a little{' '}
          <b style={{ color: '#fff' }}>ETH for gas</b> on Robinhood Chain. To get gas, switch the
          destination token below to ETH and bridge a small amount too.
        </div>

        <LiFiWidget integrator="tapkamun" config={widgetConfig} />
      </div>
    </div>
  );
}

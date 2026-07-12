import { LiFiWidget } from '@lifi/widget';
import { EthereumProvider } from '@lifi/widget-provider-ethereum';

// Robinhood Chain (4663). Native = ETH (gas); USDG = the pay token.
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';
const USDG_ADDRESS = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';

// The 0.5% integrator fee only activates once a LI.FI Partner Portal integration
// named "tapkamun" (with a fee wallet) + an API key are configured via
// VITE_LIFI_API_KEY. Until then the widget runs fee-free so quotes never break.
const LIFI_API_KEY = import.meta.env.VITE_LIFI_API_KEY;

// Built once at module scope so the wallet/wagmi config stays stable.
const widgetConfig = {
  integrator: 'tapkamun',
  apiKey: LIFI_API_KEY || undefined,
  fee: LIFI_API_KEY ? 0.005 : undefined, // 0.5%
  providers: [EthereumProvider()],
  // Default destination: ETH on Robinhood Chain, so users land with GAS first.
  // They can switch the destination token to USDG (or swap ETH<->USDG) in the widget.
  toChain: 4663,
  toToken: NATIVE_ETH,
  appearance: 'dark',
  variant: 'compact',
  theme: {
    container: { borderRadius: '16px' },
  },
};

export default function BridgeView() {
  return (
    <div style={{ padding: '10px 10px 96px', height: '100%', overflowY: 'auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, color: '#00FF00', fontWeight: 'bold', fontFamily: 'inherit' }}>
          BRIDGE / SWAP
        </div>
        <div style={{ fontSize: 9, color: '#bbb', marginTop: 6, lineHeight: 1.6, fontFamily: 'inherit' }}>
          Bring funds to <b style={{ color: '#fff' }}>Robinhood Chain</b> from any network.
          Default is <b style={{ color: '#fff' }}>ETH</b> (for gas) — switch the destination to{' '}
          <b style={{ color: '#fff' }}>USDG</b> to fund purchases. You can also swap ETH ↔ USDG here.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <LiFiWidget integrator="tapkamun" config={widgetConfig} />
      </div>
    </div>
  );
}

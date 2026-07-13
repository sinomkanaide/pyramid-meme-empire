import { useEffect, useRef } from 'react';
import { LiFiWidget, widgetEvents, WidgetEvent } from '@lifi/widget';
import { EthereumProvider } from '@lifi/widget-provider-ethereum';

// Find the sending tx hash inside a LI.FI route. Prefer the structured path,
// then fall back to a deep search — the hash isn't always attached on the
// RouteExecutionCompleted payload, so we also capture it from the update stream.
function deepFindTxHash(obj, seen = new Set()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return null;
  seen.add(obj);
  if (typeof obj.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(obj.txHash)) return obj.txHash;
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = deepFindTxHash(v, seen);
      if (found) return found;
    }
  }
  return null;
}

function getRouteTxHash(route) {
  const processes = (route?.steps || []).flatMap((s) => s?.execution?.process || []);
  const structured = processes.map((p) => p?.txHash).filter(Boolean)[0];
  return structured || deepFindTxHash(route);
}

// Robinhood Chain (4663). Native = ETH (gas); USDG = the pay token.
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';
const USDG_ADDRESS = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';

// The 0.5% integrator fee only activates once a LI.FI Partner Portal integration
// named "tapkamun-oficial" (with a fee wallet) + an API key are configured via
// VITE_LIFI_API_KEY. Until then the widget runs fee-free so quotes never break.
const LIFI_API_KEY = import.meta.env.VITE_LIFI_API_KEY;

// Built once at module scope so the wallet/wagmi config stays stable.
const widgetConfig = {
  integrator: 'tapkamun-oficial',
  apiKey: LIFI_API_KEY || undefined,
  // @lifi/widget v4 takes the integrator fee via `feeConfig.fee` (a top-level
  // `fee` is ignored). 0.005 = 0.5%; showFeePercentage surfaces it in the UI.
  feeConfig: LIFI_API_KEY ? { fee: 0.005, name: 'TapKamun', showFeePercentage: true } : undefined,
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

export default function BridgeView({ onTrade }) {
  // Always call the latest onTrade without re-subscribing on every render.
  const onTradeRef = useRef(onTrade);
  onTradeRef.current = onTrade;

  // The tx hash isn't reliably attached on the RouteExecutionCompleted payload,
  // so we capture it from the update stream (keyed by route id) and use it when
  // the route completes. claimedRoutes guards against double-claiming.
  const hashByRoute = useRef({});
  const claimedRoutes = useRef(new Set());

  useEffect(() => {
    const remember = (route) => {
      const h = getRouteTxHash(route);
      if (h && route?.id) hashByRoute.current[route.id] = h;
    };
    const onUpdated = (update) => remember(update?.route);

    const onCompleted = (route) => {
      const txHash = getRouteTxHash(route) || (route?.id ? hashByRoute.current[route.id] : null) || null;
      console.log('[TradeXP] RouteExecutionCompleted', { txHash, id: route?.id, fromChain: route?.fromChainId, toChain: route?.toChainId });
      if (txHash && route?.id && !claimedRoutes.current.has(route.id)) {
        claimedRoutes.current.add(route.id);
        onTradeRef.current?.({ txHash, fromChain: route?.fromChainId, toChain: route?.toChainId });
      }
    };

    widgetEvents.on(WidgetEvent.RouteExecutionUpdated, onUpdated);
    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onCompleted);
    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionUpdated, onUpdated);
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onCompleted);
    };
  }, []);

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
        <LiFiWidget integrator="tapkamun-oficial" config={widgetConfig} />
      </div>
    </div>
  );
}

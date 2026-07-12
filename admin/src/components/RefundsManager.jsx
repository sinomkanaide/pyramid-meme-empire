import { useState, useEffect } from 'react'

const EXPLORER = 'https://robinhoodchain.blockscout.com'

export default function RefundsManager({ apiCall }) {
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolving, setResolving] = useState(null) // txHash currently being resolved

  useEffect(() => { loadRefunds() }, [])

  const loadRefunds = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/api/admin/refunds')
      setRefunds(data.refunds || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resolveRefund = async (r) => {
    const ok = window.confirm(
      `Confirm you have MANUALLY sent ${fmtAmount(r)} back to:\n${r.wallet_address}\n\n` +
      `This only marks the record as refunded — it does NOT move any funds.`
    )
    if (!ok) return

    const refundTxHash = window.prompt(
      'Optional: paste the on-chain hash of the refund tx you sent (for the record). Leave blank to skip.'
    )

    try {
      setResolving(r.tx_hash)
      await apiCall(`/api/admin/refunds/${r.tx_hash}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ refundTxHash: refundTxHash || undefined })
      })
      await loadRefunds()
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setResolving(null)
    }
  }

  const truncate = (v) => v ? `${v.slice(0, 8)}...${v.slice(-6)}` : 'N/A'
  const fmtDate = (d) => d ? new Date(d).toLocaleString() : '-'
  // amount is stored in whole units (e.g. 5.00), currency defaults to USDG
  const fmtAmount = (r) => `${Number(r.amount).toFixed(2)} ${r.currency || 'USDG'}`

  if (loading) return <div className="page-loading">Loading refunds...</div>
  if (error) return <div className="page-error">Error: {error}</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Refunds</h1>
          <span className="page-subtitle" style={{ margin: 0 }}>
            {refunds.length} pending manual refund{refunds.length === 1 ? '' : 's'}
          </span>
        </div>
        <button className="btn" onClick={loadRefunds} style={{ whiteSpace: 'nowrap' }}>
          Refresh
        </button>
      </div>

      <p className="page-subtitle" style={{ marginTop: 0 }}>
        These users paid on-chain but the item was not granted (already owned it, can't downgrade,
        or unlimited energy). On-chain transfers are irreversible — refund manually by sending USDG
        from the shop wallet to the user's address, then mark it resolved here.
      </p>

      {refunds.length === 0 ? (
        <div className="page-loading" style={{ opacity: 0.7 }}>
          🎉 No pending refunds.
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Refund to (wallet)</th>
              <th>Item</th>
              <th>Amount</th>
              <th>Payment tx</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {refunds.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.created_at)}</td>
                <td>{r.username || `#${r.id}`}</td>
                <td>
                  <a href={`${EXPLORER}/address/${r.wallet_address}`} target="_blank" rel="noreferrer">
                    {truncate(r.wallet_address)}
                  </a>
                </td>
                <td>{r.item_name || r.type}</td>
                <td>{fmtAmount(r)}</td>
                <td>
                  <a href={`${EXPLORER}/tx/${r.tx_hash}`} target="_blank" rel="noreferrer">
                    {truncate(r.tx_hash)}
                  </a>
                </td>
                <td>
                  <button
                    className="btn btn-primary"
                    onClick={() => resolveRefund(r)}
                    disabled={resolving === r.tx_hash}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {resolving === r.tx_hash ? 'Saving...' : 'Mark refunded'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

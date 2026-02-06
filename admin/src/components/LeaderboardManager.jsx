import { useState, useEffect } from 'react'

const DEFAULT_PRIZES = [
  { position_from: 1, position_to: 10, prize_usdc: 100, description: 'Top 10' },
  { position_from: 11, position_to: 50, prize_usdc: 20, description: 'Top 11-50' },
  { position_from: 51, position_to: 100, prize_usdc: 5, description: 'Top 51-100' },
]

export default function LeaderboardManager({ apiCall }) {
  const [players, setPlayers] = useState([])
  const [prizes, setPrizes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingPrizes, setEditingPrizes] = useState(false)
  const [draftPrizes, setDraftPrizes] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/api/admin/leaderboard')
      setPlayers(data.players)
      setPrizes(data.prizes.length > 0 ? data.prizes : DEFAULT_PRIZES)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = () => {
    setDraftPrizes(prizes.length > 0 ? prizes.map(p => ({ ...p })) : [...DEFAULT_PRIZES])
    setEditingPrizes(true)
  }

  const updateDraft = (index, field, value) => {
    setDraftPrizes(prev => prev.map((p, i) =>
      i === index ? { ...p, [field]: field === 'description' ? value : Number(value) } : p
    ))
  }

  const addPrizeRow = () => {
    const last = draftPrizes[draftPrizes.length - 1]
    setDraftPrizes(prev => [...prev, {
      position_from: (last?.position_to || 0) + 1,
      position_to: (last?.position_to || 0) + 10,
      prize_usdc: 5,
      description: ''
    }])
  }

  const removePrizeRow = (index) => {
    setDraftPrizes(prev => prev.filter((_, i) => i !== index))
  }

  const savePrizes = async () => {
    setSaving(true)
    try {
      const data = await apiCall('/api/admin/leaderboard/prizes', {
        method: 'PUT',
        body: JSON.stringify({ prizes: draftPrizes })
      })
      setPrizes(data.prizes)
      setEditingPrizes(false)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const calculateTotal = (prizeList) => {
    return prizeList.reduce((sum, p) => {
      const range = (p.position_to || 0) - (p.position_from || 0) + 1
      return sum + ((p.prize_usdc || 0) * range)
    }, 0)
  }

  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A'

  if (loading) return <div className="page-loading">Loading leaderboard...</div>
  if (error) return <div className="page-error">Error: {error}</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
        <span className="page-subtitle" style={{ margin: 0 }}>{players.length} players</span>
      </div>

      {/* Prize Configuration */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header-row">
          <h3 className="card-title" style={{ margin: 0 }}>Prize Structure</h3>
          {!editingPrizes ? (
            <button className="btn btn-sm btn-primary" onClick={startEditing}>Edit Prizes</button>
          ) : (
            <div className="action-btns">
              <button className="btn btn-sm" onClick={() => setEditingPrizes(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={savePrizes} disabled={saving}>
                {saving ? 'Saving...' : 'Save Prizes'}
              </button>
            </div>
          )}
        </div>

        {editingPrizes ? (
          <div className="prize-editor">
            {draftPrizes.map((prize, i) => (
              <div key={i} className="prize-row">
                <div className="prize-field">
                  <label>From #</label>
                  <input type="number" className="login-input" value={prize.position_from} onChange={e => updateDraft(i, 'position_from', e.target.value)} style={{ width: 70 }} />
                </div>
                <div className="prize-field">
                  <label>To #</label>
                  <input type="number" className="login-input" value={prize.position_to} onChange={e => updateDraft(i, 'position_to', e.target.value)} style={{ width: 70 }} />
                </div>
                <div className="prize-field">
                  <label>$ USDC each</label>
                  <input type="number" className="login-input" value={prize.prize_usdc} onChange={e => updateDraft(i, 'prize_usdc', e.target.value)} style={{ width: 90 }} />
                </div>
                <div className="prize-field" style={{ flex: 1 }}>
                  <label>Description</label>
                  <input className="login-input" value={prize.description} onChange={e => updateDraft(i, 'description', e.target.value)} placeholder="e.g. Top players" />
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => removePrizeRow(i)} style={{ alignSelf: 'flex-end', marginBottom: 2 }}>X</button>
              </div>
            ))}
            <div className="prize-editor-footer">
              <button className="btn btn-sm" onClick={addPrizeRow}>+ Add Range</button>
              <div className="prize-total">
                Total: <strong className="text-accent">${calculateTotal(draftPrizes).toLocaleString()} USDC</strong>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {prizes.length > 0 ? (
              <div className="prize-display">
                {prizes.map((p, i) => (
                  <div key={i} className="prize-display-row">
                    <span className="prize-range">#{p.position_from} - #{p.position_to}</span>
                    <span className="text-accent font-bold">${Number(p.prize_usdc).toFixed(0)} each</span>
                    <span className="text-muted">{p.description}</span>
                  </div>
                ))}
                <div className="prize-total">
                  Total: <strong className="text-accent">${calculateTotal(prizes).toLocaleString()} USDC</strong>
                </div>
              </div>
            ) : (
              <p className="text-muted" style={{ padding: 8 }}>No prizes configured yet. Click Edit to set up.</p>
            )}
          </div>
        )}
      </div>

      {/* Top Players */}
      <div className="table-container" style={{ marginTop: 16 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Wallet</th>
              <th>Username</th>
              <th>Level</th>
              <th>Bricks</th>
              <th>Taps</th>
              <th>Status</th>
              <th>Prize</th>
            </tr>
          </thead>
          <tbody>
            {players.map(player => {
              const prize = prizes.find(p => player.rank >= p.position_from && player.rank <= p.position_to)
              return (
                <tr key={player.id} className={player.rank <= 3 ? 'row-highlight' : ''}>
                  <td className="font-bold">
                    {player.rank <= 3 ? ['', '🥇', '🥈', '🥉'][player.rank] : player.rank}
                  </td>
                  <td className="font-mono">{truncate(player.wallet_address)}</td>
                  <td>{player.username || '-'}</td>
                  <td>{player.level}</td>
                  <td>{(player.bricks || 0).toLocaleString()}</td>
                  <td>{(player.total_taps || 0).toLocaleString()}</td>
                  <td>
                    {player.has_battle_pass && <span className="badge badge-gold">BP</span>}
                    {player.is_premium && !player.has_battle_pass && <span className="badge badge-blue">Premium</span>}
                    {!player.is_premium && !player.has_battle_pass && <span className="badge">Free</span>}
                  </td>
                  <td>{prize ? <span className="text-accent">${Number(prize.prize_usdc).toFixed(0)}</span> : <span className="text-muted">-</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

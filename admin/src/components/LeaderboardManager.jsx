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
  // Seasons
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState('')
  const [activeSeason, setActiveSeason] = useState(null)
  const [showCreateSeason, setShowCreateSeason] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [lbData, seasonsData] = await Promise.all([
        apiCall('/api/admin/leaderboard'),
        apiCall('/api/admin/leaderboard/seasons').catch(() => ({ seasons: [] }))
      ])
      setPlayers(lbData.players)
      setPrizes(lbData.prizes.length > 0 ? lbData.prizes : DEFAULT_PRIZES)
      setActiveSeason(lbData.activeSeason || null)
      setSeasons(seasonsData.seasons || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadLeaderboard = async (seasonId) => {
    try {
      const url = seasonId
        ? `/api/admin/leaderboard?season_id=${seasonId}`
        : '/api/admin/leaderboard'
      const data = await apiCall(url)
      setPlayers(data.players)
      setPrizes(data.prizes.length > 0 ? data.prizes : DEFAULT_PRIZES)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const handleSeasonChange = (val) => {
    setSelectedSeason(val)
    loadLeaderboard(val || null)
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

  const activateSeason = async (id) => {
    try {
      await apiCall(`/api/admin/leaderboard/seasons/${id}/activate`, { method: 'PATCH' })
      loadData()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const deleteSeason = async (id) => {
    if (!confirm('Delete this season?')) return
    try {
      await apiCall(`/api/admin/leaderboard/seasons/${id}`, { method: 'DELETE' })
      loadData()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const createSeason = async (data) => {
    try {
      await apiCall('/api/admin/leaderboard/seasons', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      setShowCreateSeason(false)
      loadData()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const calculateTotal = (prizeList) => {
    return prizeList.reduce((sum, p) => {
      const range = (p.position_to || 0) - (p.position_from || 0) + 1
      return sum + ((p.prize_usdc || 0) * range)
    }, 0)
  }

  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : '-'

  if (loading) return <div className="page-loading">Loading leaderboard...</div>
  if (error) return <div className="page-error">Error: {error}</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
        <span className="page-subtitle" style={{ margin: 0 }}>{players.length} players</span>
      </div>

      {/* Season Selector */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header-row">
          <h3 className="card-title" style={{ margin: 0 }}>Seasons</h3>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateSeason(true)}>+ New Season</button>
        </div>

        {activeSeason && (
          <div style={{ padding: '8px 12px', background: 'rgba(0,255,136,0.08)', borderRadius: 6, margin: '8px 0', fontSize: 12 }}>
            Active: <strong className="text-green">{activeSeason.name}</strong>
            {' '}({fmtDate(activeSeason.starts_at)} - {fmtDate(activeSeason.ends_at)})
            {activeSeason.prize_pool_usdc > 0 && <span className="text-accent"> | Pool: ${Number(activeSeason.prize_pool_usdc).toLocaleString()}</span>}
          </div>
        )}

        {seasons.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="form-label" style={{ margin: 0, fontSize: 11 }}>Filter by season:</label>
              <select className="login-input" value={selectedSeason} onChange={e => handleSeasonChange(e.target.value)} style={{ width: 220 }}>
                <option value="">All Time</option>
                {seasons.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.is_active ? '(Active)' : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {seasons.map(s => (
                <div key={s.id} className="season-chip" style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                  background: s.is_active ? 'rgba(0,255,136,0.12)' : 'rgba(139,92,246,0.08)',
                  borderRadius: 6, fontSize: 11, border: s.is_active ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(139,92,246,0.15)'
                }}>
                  <span>{s.name}</span>
                  <span className="text-muted">{fmtDate(s.starts_at)}-{fmtDate(s.ends_at)}</span>
                  {!s.is_active && <button className="btn btn-sm" style={{ padding: '1px 6px', fontSize: 10 }} onClick={() => activateSeason(s.id)}>Activate</button>}
                  {s.is_active && <span className="badge badge-green" style={{ fontSize: 9 }}>Live</span>}
                  <button className="btn btn-sm btn-danger" style={{ padding: '1px 6px', fontSize: 10 }} onClick={() => deleteSeason(s.id)}>X</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-muted" style={{ padding: 8, fontSize: 12 }}>No seasons created yet. Leaderboard shows all-time rankings.</p>
        )}
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
                    {player.rank <= 3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][player.rank] : player.rank}
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

      {showCreateSeason && (
        <SeasonCreateModal onSave={createSeason} onClose={() => setShowCreateSeason(false)} />
      )}
    </div>
  )
}

function SeasonCreateModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [prizePool, setPrizePool] = useState(0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !startsAt || !endsAt) { alert('Name and dates are required'); return }
    setSaving(true)
    await onSave({
      name: name.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      prize_pool_usdc: Number(prizePool) || 0
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create Season</h2>

        <label className="form-label">Season Name *</label>
        <input className="login-input" value={name} onChange={e => setName(e.target.value)} placeholder="Season 1 - Genesis" autoFocus />

        <div className="form-row">
          <div>
            <label className="form-label">Start Date *</label>
            <input className="login-input" type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
          </div>
          <div>
            <label className="form-label">End Date *</label>
            <input className="login-input" type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
          </div>
        </div>

        <label className="form-label">Prize Pool (USDC)</label>
        <input className="login-input" type="number" value={prizePool} onChange={e => setPrizePool(e.target.value)} placeholder="0" />

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim() || !startsAt || !endsAt}>
            {saving ? 'Creating...' : 'Create Season'}
          </button>
        </div>
      </div>
    </div>
  )
}

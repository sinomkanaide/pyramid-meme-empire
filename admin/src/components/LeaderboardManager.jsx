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
  const [recalculating, setRecalculating] = useState(false)
  const [recalcResult, setRecalcResult] = useState(null)
  const [freezing, setFreezing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagResult, setDiagResult] = useState(null)

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

  const recalculateLevels = async () => {
    if (!confirm('Recalculate ALL user levels based on their XP? This will fix any stuck levels.')) return
    setRecalculating(true)
    setRecalcResult(null)
    try {
      const data = await apiCall('/api/admin/recalculate-levels', { method: 'POST' })
      setRecalcResult(data)
      if (data.fixed > 0) {
        loadData()
      }
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setRecalculating(false)
    }
  }

  const toggleFreeze = async () => {
    const isFrozen = activeSeason?.is_frozen
    const msg = isFrozen
      ? 'UNFREEZE the leaderboard? Rankings will go back to live data.'
      : 'FREEZE the leaderboard? This will lock the current standings as the final Season 1 results. Players can still play but the leaderboard won\'t change.'
    if (!confirm(msg)) return
    setFreezing(true)
    try {
      const data = await apiCall('/api/admin/leaderboard/freeze', { method: 'PATCH' })
      if (data.success) {
        alert(data.frozen
          ? `Leaderboard FROZEN! ${data.players_snapshot} players snapshot saved.`
          : 'Leaderboard UNFROZEN. Live rankings restored.'
        )
        loadData()
      }
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setFreezing(false)
    }
  }

  const exportCSV = async () => {
    setExporting(true)
    try {
      const data = await apiCall('/api/admin/leaderboard/export')
      if (!data.players || data.players.length === 0) {
        alert('No players to export')
        return
      }

      // Build CSV
      const headers = ['Rank', 'Wallet', 'Username', 'Discord', 'Twitter', 'Level', 'Bricks', 'Total Taps', 'Taps/Min', 'Bot Score %', 'Flags', 'Is Flagged', 'Flag Reason', 'Premium', 'Battle Pass', 'Purchases', 'Registered']
      const rows = data.players.map(p => [
        p.rank,
        p.wallet,
        p.username,
        p.discord,
        p.twitter,
        p.level,
        p.bricks,
        p.totalTaps,
        p.tapsPerMin,
        p.botScore,
        p.flags.join('; '),
        p.isFlagged ? 'YES' : '',
        p.flagReason,
        p.isPremium ? 'YES' : '',
        p.hasBattlePass ? 'YES' : '',
        p.purchases,
        new Date(p.registeredAt).toISOString().split('T')[0]
      ])

      const csvContent = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const prefix = data.seasonName ? data.seasonName.replace(/\s+/g, '_') : 'leaderboard'
      const frozen = data.frozenAt ? '_FROZEN' : ''
      a.download = `${prefix}${frozen}_wallets_audit_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

      alert(`Exported ${data.players.length} players${data.frozenAt ? ' (frozen snapshot)' : ' (live)'}`)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const diagnoseLevels = async () => {
    const input = prompt('Enter user IDs to diagnose (comma-separated).\nExample: 222,357,393,399')
    if (!input) return
    const userIds = input.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
    if (userIds.length === 0) { alert('No valid user IDs'); return }
    setDiagnosing(true)
    setDiagResult(null)
    try {
      const data = await apiCall('/api/admin/diagnose-levels', {
        method: 'POST',
        body: JSON.stringify({ userIds })
      })
      setDiagResult(data)
    } catch (err) {
      alert('Diagnosis failed: ' + err.message)
    } finally {
      setDiagnosing(false)
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
        <div>
          <h1 className="page-title">Leaderboard</h1>
          <span className="page-subtitle" style={{ margin: 0 }}>{players.length} players</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeSeason && (
            <button
              className={`btn ${activeSeason.is_frozen ? 'btn-danger' : 'btn-primary'}`}
              onClick={toggleFreeze}
              disabled={freezing}
              style={{
                whiteSpace: 'nowrap',
                ...(activeSeason.is_frozen ? {
                  background: 'rgba(0,170,255,0.15)',
                  borderColor: '#00aaff',
                  color: '#00aaff',
                  animation: 'pulse-freeze 2s ease-in-out infinite'
                } : {
                  background: 'rgba(255,68,102,0.15)',
                  borderColor: '#ff4466',
                  color: '#ff4466'
                })
              }}
            >
              {freezing ? 'Processing...' : activeSeason.is_frozen ? '\u{2744}\u{FE0F} FROZEN - Click to Unfreeze' : '\u{1F6D1} Freeze Leaderboard'}
            </button>
          )}
          <button
            className="btn"
            onClick={diagnoseLevels}
            disabled={diagnosing}
            style={{ whiteSpace: 'nowrap', borderColor: '#ff4466', color: '#ff4466' }}
          >
            {diagnosing ? 'Diagnosing...' : '\u{1F50D} Diagnose Levels'}
          </button>
          <button
            className="btn"
            onClick={exportCSV}
            disabled={exporting}
            style={{ whiteSpace: 'nowrap', borderColor: '#ffd700', color: '#ffd700' }}
          >
            {exporting ? 'Exporting...' : '\u{1F4E5} Export Wallets + Audit'}
          </button>
          <button
            className="btn btn-primary"
            onClick={recalculateLevels}
            disabled={recalculating}
            style={{ whiteSpace: 'nowrap' }}
          >
            {recalculating ? 'Recalculating...' : 'Recalculate All Levels'}
          </button>
        </div>
      </div>

      {activeSeason?.is_frozen && (
        <div style={{
          background: 'rgba(0,170,255,0.1)',
          border: '1px solid rgba(0,170,255,0.4)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span style={{ fontSize: 24 }}>{'\u{2744}\u{FE0F}'}</span>
          <div>
            <div style={{ fontWeight: 'bold', color: '#00aaff', fontSize: 14 }}>
              LEADERBOARD FROZEN - Season 1 Final Standings
            </div>
            <div style={{ fontSize: 11, color: '#a0a0b8', marginTop: 2 }}>
              Frozen at: {new Date(activeSeason.frozen_at).toLocaleString()} | Players can still play but rankings are locked.
            </div>
          </div>
        </div>
      )}

      {recalcResult && (
        <div className="card" style={{ marginTop: 12, padding: '12px 16px', background: recalcResult.fixed > 0 ? 'rgba(0,255,136,0.08)' : 'rgba(139,92,246,0.08)', border: recalcResult.fixed > 0 ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(139,92,246,0.15)' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: recalcResult.fixed > 0 ? 8 : 0 }}>
            {recalcResult.fixed > 0
              ? `Fixed ${recalcResult.fixed} of ${recalcResult.total} users`
              : `All ${recalcResult.total} users have correct levels`
            }
          </div>
          {recalcResult.fixes && recalcResult.fixes.length > 0 && (
            <div style={{ fontSize: 11, maxHeight: 200, overflowY: 'auto' }}>
              {recalcResult.fixes.map((f, i) => (
                <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  User #{f.userId}: Level {f.oldLevel} → <strong className="text-green">{f.newLevel}</strong> (uncapped: {f.uncappedLevel}, {f.bricks.toLocaleString()} XP)
                  {f.hasBattlePassFlag && <span className="badge badge-gold" style={{ marginLeft: 6, fontSize: 9 }}>BP flag</span>}
                  {f.hasBattlePassActive ? <span className="badge badge-green" style={{ marginLeft: 4, fontSize: 9 }}>BP ACTIVE</span> : f.hasBattlePassFlag ? <span className="badge" style={{ marginLeft: 4, fontSize: 9, background: 'rgba(255,68,102,0.2)', color: '#ff4466', border: '1px solid #ff4466' }}>BP EXPIRED</span> : null}
                  {f.battlePassExpires && <span className="text-muted" style={{ marginLeft: 4, fontSize: 9 }}>exp: {new Date(f.battlePassExpires).toLocaleDateString()}</span>}
                  {f.isPremiumActive && <span className="badge badge-blue" style={{ marginLeft: 4, fontSize: 9 }}>Premium</span>}
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-sm" onClick={() => setRecalcResult(null)} style={{ marginTop: 8, fontSize: 10 }}>Dismiss</button>
        </div>
      )}

      {diagResult && (
        <div className="card" style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,68,102,0.05)', border: '1px solid rgba(255,68,102,0.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#ff4466' }}>
            Level Diagnosis — Server time: {new Date(diagResult.serverTime).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, maxHeight: 300, overflowY: 'auto' }}>
            {diagResult.diagnoses.map((d, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 'bold' }}>
                  User #{d.userId} — {d.wallet.slice(0, 10)}... — {d.username || 'no name'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, margin: '4px 0' }}>
                  <span>Bricks: <strong>{(d.bricks || 0).toLocaleString()}</strong></span>
                  <span>DB Level: <strong>{d.currentLevelInDB}</strong></span>
                  <span>Uncapped: <strong style={{ color: '#00ffff' }}>{d.uncappedLevel}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0' }}>
                  <span>Premium: {d.premium.flag ? (d.premium.isActive ? <strong className="text-green">ACTIVE</strong> : <strong style={{ color: '#ff4466' }}>EXPIRED {d.premium.expiresAt ? new Date(d.premium.expiresAt).toLocaleDateString() : ''}</strong>) : <span className="text-muted">No</span>}</span>
                  <span>Battle Pass: {d.battlePass.flag ? (d.battlePass.isPermanent ? <strong className="text-green">PERMANENT</strong> : d.battlePass.isActive ? <strong className="text-green">ACTIVE until {new Date(d.battlePass.expiresAt).toLocaleDateString()}</strong> : <strong style={{ color: '#ff4466' }}>EXPIRED {new Date(d.battlePass.expiresAt).toLocaleDateString()}</strong>) : <span className="text-muted">No</span>}</span>
                </div>
                <div style={{ marginTop: 4, padding: '4px 8px', borderRadius: 4, background: d.diagnosis.includes('EXPIRED') ? 'rgba(255,68,102,0.15)' : d.diagnosis.includes('ACTIVE') ? 'rgba(0,255,136,0.1)' : 'rgba(139,92,246,0.08)', fontSize: 11, fontWeight: 'bold' }}>
                  {d.diagnosis}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => setDiagResult(null)} style={{ marginTop: 8, fontSize: 10 }}>Dismiss</button>
        </div>
      )}

      {/* Season Selector */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header-row">
          <h3 className="card-title" style={{ margin: 0 }}>Seasons</h3>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateSeason(true)}>+ New Season</button>
        </div>

        {activeSeason && (
          <div style={{
            padding: '8px 12px',
            background: activeSeason.is_frozen ? 'rgba(0,170,255,0.08)' : 'rgba(0,255,136,0.08)',
            borderRadius: 6, margin: '8px 0', fontSize: 12,
            border: activeSeason.is_frozen ? '1px solid rgba(0,170,255,0.2)' : 'none'
          }}>
            Active: <strong style={{ color: activeSeason.is_frozen ? '#00aaff' : '#00ff88' }}>{activeSeason.name}</strong>
            {' '}({fmtDate(activeSeason.starts_at)} - {fmtDate(activeSeason.ends_at)})
            {activeSeason.prize_pool_usdc > 0 && <span className="text-accent"> | Pool: ${Number(activeSeason.prize_pool_usdc).toLocaleString()}</span>}
            {activeSeason.is_frozen && <span style={{ color: '#00aaff', fontWeight: 'bold' }}> | {'\u{2744}\u{FE0F}'} FROZEN</span>}
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
                  {s.is_active && !s.is_frozen && <span className="badge badge-green" style={{ fontSize: 9 }}>Live</span>}
                  {s.is_active && s.is_frozen && <span className="badge" style={{ fontSize: 9, background: 'rgba(0,170,255,0.2)', color: '#00aaff', border: '1px solid rgba(0,170,255,0.4)' }}>{'\u{2744}\u{FE0F}'} Frozen</span>}
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

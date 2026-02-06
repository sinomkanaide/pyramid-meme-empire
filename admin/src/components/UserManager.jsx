import { useState, useEffect } from 'react'
import XPGrantModal from './XPGrantModal'

export default function UserManager({ apiCall }) {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 })
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedUser, setExpandedUser] = useState(null)
  const [userDetail, setUserDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [xpGrantUser, setXpGrantUser] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { loadUsers() }, [filter, pagination.page])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        filter,
        ...(search && { search })
      })
      const data = await apiCall(`/api/admin/users?${params}`)
      setUsers(data.users)
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    loadUsers()
  }

  const loadUserDetail = async (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null)
      setUserDetail(null)
      return
    }
    setExpandedUser(userId)
    setDetailLoading(true)
    try {
      const data = await apiCall(`/api/admin/users/${userId}`)
      setUserDetail(data)
    } catch (err) {
      alert('Failed to load user: ' + err.message)
      setExpandedUser(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const grantXP = async (userId, amount, reason) => {
    await apiCall(`/api/admin/users/${userId}/grant-xp`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason })
    })
    loadUsers()
    if (expandedUser === userId) loadUserDetail(userId)
  }

  const grantPremium = async (userId) => {
    if (!confirm('Grant Premium to this user?')) return
    setActionLoading(`premium-${userId}`)
    try {
      await apiCall(`/api/admin/users/${userId}/grant-premium`, { method: 'POST' })
      loadUsers()
      if (expandedUser === userId) loadUserDetail(userId)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const grantBattlePass = async (userId) => {
    if (!confirm('Grant Battle Pass (30 days) to this user?')) return
    setActionLoading(`bp-${userId}`)
    try {
      await apiCall(`/api/admin/users/${userId}/grant-battlepass`, { method: 'POST' })
      loadUsers()
      if (expandedUser === userId) loadUserDetail(userId)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const toggleBan = async (userId, isBanned) => {
    const action = isBanned ? 'unban' : 'ban'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return
    setActionLoading(`ban-${userId}`)
    try {
      await apiCall(`/api/admin/users/${userId}/${action}`, { method: 'POST' })
      loadUsers()
      if (expandedUser === userId) loadUserDetail(userId)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : 'N/A'

  if (error) return <div className="page-error">Error: {error}</div>

  return (
    <div className="page">
      <h1 className="page-title">User Manager</h1>
      <p className="page-subtitle">{pagination.totalCount} users total</p>

      <div className="filters-bar">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            className="search-input"
            placeholder="Search wallet address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-sm btn-primary">Search</button>
          {search && (
            <button type="button" className="btn btn-sm" onClick={() => { setSearch(''); setTimeout(loadUsers, 0) }}>Clear</button>
          )}
        </form>

        <div className="filter-tabs">
          {['all', 'premium', 'battlepass', 'banned'].map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => { setFilter(f); setPagination(prev => ({ ...prev, page: 1 })); setExpandedUser(null) }}
            >
              {f === 'all' ? 'All' : f === 'battlepass' ? 'Battle Pass' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="page-loading">Loading users...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Wallet</th>
                  <th>Level</th>
                  <th>Bricks (XP)</th>
                  <th>Taps</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <>
                    <tr
                      key={user.id}
                      className={`user-row-clickable ${expandedUser === user.id ? 'row-expanded' : ''}`}
                      onClick={() => loadUserDetail(user.id)}
                    >
                      <td>{user.id}</td>
                      <td className="font-mono">{truncate(user.wallet_address)}</td>
                      <td>{user.level || 1}</td>
                      <td>{(user.bricks || 0).toLocaleString()}</td>
                      <td>{(user.total_taps || 0).toLocaleString()}</td>
                      <td>
                        {user.is_banned && <span className="badge badge-red">Banned</span>}
                        {user.has_battle_pass && <span className="badge badge-gold">BP</span>}
                        {user.is_premium && !user.has_battle_pass && <span className="badge badge-blue">Premium</span>}
                        {!user.is_premium && !user.has_battle_pass && !user.is_banned && <span className="badge">Free</span>}
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>

                    {/* Expanded Detail */}
                    {expandedUser === user.id && (
                      <tr key={`detail-${user.id}`}>
                        <td colSpan="7" className="user-detail-cell">
                          {detailLoading ? (
                            <div className="page-loading">Loading details...</div>
                          ) : userDetail ? (
                            <UserDetail
                              detail={userDetail}
                              onGrantXP={() => setXpGrantUser(user)}
                              onGrantPremium={() => grantPremium(user.id)}
                              onGrantBattlePass={() => grantBattlePass(user.id)}
                              onToggleBan={() => toggleBan(user.id, userDetail.user.is_banned)}
                              actionLoading={actionLoading}
                              userId={user.id}
                            />
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan="7" className="text-center">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              className="btn btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </button>
            <span className="pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} users)
            </span>
            <button
              className="btn btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* XP Grant Modal */}
      {xpGrantUser && (
        <XPGrantModal
          user={xpGrantUser}
          onGrant={(amount, reason) => grantXP(xpGrantUser.id, amount, reason)}
          onClose={() => setXpGrantUser(null)}
        />
      )}
    </div>
  )
}

function UserDetail({ detail, onGrantXP, onGrantPremium, onGrantBattlePass, onToggleBan, actionLoading, userId }) {
  const { user, transactions, completedQuests, referrals, xpGrants } = detail
  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <div className="user-detail">
      {/* Action Buttons */}
      <div className="user-detail-actions">
        <button className="btn btn-sm btn-primary" onClick={onGrantXP}>Grant XP</button>
        <button
          className="btn btn-sm btn-success"
          onClick={onGrantPremium}
          disabled={user.is_premium || actionLoading === `premium-${userId}`}
        >
          {user.is_premium ? 'Already Premium' : actionLoading === `premium-${userId}` ? '...' : 'Grant Premium'}
        </button>
        <button
          className="btn btn-sm btn-success"
          onClick={onGrantBattlePass}
          disabled={actionLoading === `bp-${userId}`}
        >
          {actionLoading === `bp-${userId}` ? '...' : 'Grant Battle Pass'}
        </button>
        <button
          className={`btn btn-sm ${user.is_banned ? 'btn-success' : 'btn-danger'}`}
          onClick={onToggleBan}
          disabled={actionLoading === `ban-${userId}`}
        >
          {actionLoading === `ban-${userId}` ? '...' : user.is_banned ? 'Unban' : 'Ban User'}
        </button>
      </div>

      {/* Info Grid */}
      <div className="user-detail-grid">
        <div className="detail-section">
          <h4>Game Progress</h4>
          <div className="detail-rows">
            <div><span>Wallet</span><span className="font-mono">{user.wallet_address}</span></div>
            <div><span>Level</span><span>{user.level || 1}</span></div>
            <div><span>Bricks (XP)</span><span>{(user.bricks || 0).toLocaleString()}</span></div>
            <div><span>Total Taps</span><span>{(user.total_taps || 0).toLocaleString()}</span></div>
            <div><span>PME Tokens</span><span>{(user.pme_tokens || 0).toLocaleString()}</span></div>
            <div><span>Energy</span><span>{user.energy || 0} / {user.max_energy || 100}</span></div>
            <div><span>Total Bricks Earned</span><span>{(user.total_bricks_earned || 0).toLocaleString()}</span></div>
          </div>
        </div>

        <div className="detail-section">
          <h4>Status</h4>
          <div className="detail-rows">
            <div><span>Premium</span><span className={user.is_premium ? 'text-accent' : ''}>{user.is_premium ? 'Yes' : 'No'}</span></div>
            <div><span>Battle Pass</span><span className={user.has_battle_pass ? 'text-accent' : ''}>{user.has_battle_pass ? 'Yes' : 'No'}</span></div>
            {user.battle_pass_expires_at && <div><span>BP Expires</span><span>{new Date(user.battle_pass_expires_at).toLocaleDateString()}</span></div>}
            <div><span>Banned</span><span className={user.is_banned ? 'text-red' : ''}>{user.is_banned ? 'YES' : 'No'}</span></div>
            <div><span>Boost</span><span>{user.boost_multiplier > 1 ? `x${user.boost_multiplier}` : 'None'}</span></div>
            {user.quest_bonus_multiplier > 1 && <div><span>Quest Bonus</span><span className="text-green">+{Math.round((user.quest_bonus_multiplier - 1) * 100)}%</span></div>}
            <div><span>Referral Code</span><span className="font-mono">{user.referral_code || 'N/A'}</span></div>
            <div><span>Referrals</span><span>{referrals.total} total, {referrals.verified} verified</span></div>
          </div>
        </div>
      </div>

      {/* Completed Quests */}
      {completedQuests.length > 0 && (
        <div className="detail-section">
          <h4>Completed Quests ({completedQuests.length})</h4>
          <div className="detail-tags">
            {completedQuests.map((q, i) => (
              <span key={i} className="badge badge-green">{q.title || `Quest #${q.quest_id}`} (+{q.xp_earned} XP)</span>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      {transactions.length > 0 && (
        <div className="detail-section">
          <h4>Transactions ({transactions.length})</h4>
          <div className="mini-table">
            <table className="admin-table">
              <thead>
                <tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((tx, i) => (
                  <tr key={i}>
                    <td>{tx.item_type || tx.type}</td>
                    <td className="text-accent">${Number(tx.amount).toFixed(2)}</td>
                    <td><span className={`badge ${tx.status === 'confirmed' ? 'badge-green' : 'badge-gray'}`}>{tx.status}</span></td>
                    <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* XP Grants History */}
      {xpGrants.length > 0 && (
        <div className="detail-section">
          <h4>XP Grants History ({xpGrants.length})</h4>
          <div className="mini-table">
            <table className="admin-table">
              <thead>
                <tr><th>Amount</th><th>Reason</th><th>By</th><th>Date</th></tr>
              </thead>
              <tbody>
                {xpGrants.map((g, i) => (
                  <tr key={i}>
                    <td className="text-accent">+{g.amount.toLocaleString()}</td>
                    <td>{g.reason}</td>
                    <td className="font-mono">{truncate(g.granted_by)}</td>
                    <td>{new Date(g.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

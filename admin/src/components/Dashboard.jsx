import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const CHART_COLORS = ['#a855f7', '#00ffff', '#ffd700', '#00ff88', '#ff4466', '#4488ff']

const PIE_COLORS = ['#a855f7', '#00ffff', '#ffd700', '#00ff88', '#ff4466']

const ITEM_LABELS = {
  premium: 'Premium',
  boost_2x: 'Boost X2',
  boost_5x: 'Boost X5',
  energy_refill: 'Energy',
  battle_pass: 'Battle Pass'
}

const PRIVACY_CYCLE = { visible: 'blur', blur: 'hidden', hidden: 'visible' }
const PRIVACY_LABEL = { visible: '\u{1F441} Show', blur: '\u{1F512} Blur', hidden: '\u{2B1B} Hide' }
const PRIVACY_COLOR = { visible: '#00ff88', blur: '#ffd700', hidden: '#ff4466' }

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function Dashboard({ apiCall }) {
  const [overview, setOverview] = useState(null)
  const [userData, setUserData] = useState(null)
  const [revenueData, setRevenueData] = useState(null)
  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Privacy/Partner mode
  const [editingVisibility, setEditingVisibility] = useState(false)
  const [partnerView, setPartnerView] = useState(false)
  const [privacy, setPrivacy] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dashboard_privacy') || '{}') }
    catch { return {} }
  })

  const togglePrivacy = (id) => {
    setPrivacy(prev => {
      const current = prev[id] || 'visible'
      const updated = { ...prev, [id]: PRIVACY_CYCLE[current] }
      localStorage.setItem('dashboard_privacy', JSON.stringify(updated))
      return updated
    })
  }

  const resetPrivacy = () => {
    setPrivacy({})
    localStorage.removeItem('dashboard_privacy')
  }

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [overviewRes, usersRes, revenueRes, engagementRes] = await Promise.all([
        apiCall('/api/admin/analytics/overview'),
        apiCall('/api/admin/analytics/users'),
        apiCall('/api/admin/analytics/revenue'),
        apiCall('/api/admin/analytics/engagement')
      ])

      setOverview(overviewRes)
      setUserData(usersRes)
      setRevenueData(revenueRes)
      setEngagement(engagementRes)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="page-loading">Loading dashboard...</div>
  if (error) return <div className="page-error">Error: {error} <button className="btn btn-sm" onClick={loadAllData} style={{ marginLeft: 8 }}>Retry</button></div>

  // Calculate week-over-week change
  const weekChange = overview && overview.newUsers.week > 0
    ? Math.round(((overview.newUsers.week - (overview.newUsers.month - overview.newUsers.week)) / Math.max(1, overview.newUsers.month - overview.newUsers.week)) * 100)
    : 0

  const isActive = editingVisibility || partnerView

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!partnerView && (
            <button
              className={`btn btn-sm ${editingVisibility ? 'btn-active' : ''}`}
              onClick={() => { setEditingVisibility(!editingVisibility); setPartnerView(false) }}
              style={editingVisibility ? { background: '#ffd70030', borderColor: '#ffd700', color: '#ffd700' } : {}}
            >
              {editingVisibility ? '\u{270F}\u{FE0F} Editing...' : '\u{270F}\u{FE0F} Edit Visibility'}
            </button>
          )}
          {!editingVisibility && (
            <button
              className={`btn btn-sm ${partnerView ? 'btn-active' : ''}`}
              onClick={() => { setPartnerView(!partnerView); setEditingVisibility(false) }}
              style={partnerView ? { background: '#00ff8830', borderColor: '#00ff88', color: '#00ff88' } : {}}
            >
              {partnerView ? '\u{1F441} Partner View ON' : '\u{1F465} Partner View'}
            </button>
          )}
          {editingVisibility && (
            <button className="btn btn-sm" onClick={resetPrivacy} style={{ borderColor: '#ff4466', color: '#ff4466' }}>
              Reset All
            </button>
          )}
          {!editingVisibility && !partnerView && (
            <button className="btn btn-sm" onClick={loadAllData}>Refresh</button>
          )}
        </div>
      </div>

      {editingVisibility && (
        <div style={{ background: '#ffd70015', border: '1px solid #ffd70040', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#ffd700' }}>
          Click the badges on each widget to cycle: <strong>Show</strong> → <strong>Blur</strong> → <strong>Hide</strong>. Then switch to <strong>Partner View</strong> to see the result.
        </div>
      )}

      {/* ================================================================
          SECTION 1: METRIC CARDS
          ================================================================ */}
      <div className="stats-grid">
        <PW id="stat_total_users" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <StatCard
            label="Total Users"
            value={overview.totalUsers.toLocaleString()}
            change={weekChange !== 0 ? `${weekChange > 0 ? '+' : ''}${weekChange}% vs prev week` : null}
            changePositive={weekChange >= 0}
          />
        </PW>
        <PW id="stat_active_today" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <StatCard label="Active Today" value={overview.activeToday.toLocaleString()} />
        </PW>
        <PW id="stat_revenue_total" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <StatCard label="Revenue Total" value={`$${overview.revenueTotal.toFixed(2)}`} accent />
        </PW>
        <PW id="stat_revenue_today" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <StatCard label="Revenue Today" value={`$${overview.revenuePeriod.today.toFixed(2)}`} />
        </PW>
        <PW id="stat_premium" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <StatCard label="Premium Users" value={overview.totalPremium} />
        </PW>
        <PW id="stat_battlepass" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <StatCard label="Battle Pass" value={overview.totalBattlePass} />
        </PW>
      </div>

      {/* ================================================================
          SECTION 2: CHARTS
          ================================================================ */}
      <div className="charts-grid">
        {/* New Users per Day */}
        <PW id="chart_new_users" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">New Users (30 days)</h3>
            {userData?.registrationsByDay?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={userData.registrationsByDay.map(d => ({ ...d, date: formatDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
                  <XAxis dataKey="date" stroke="#5a5a78" fontSize={11} />
                  <YAxis stroke="#5a5a78" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #8b5cf6', borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#00ffff" strokeWidth={2} dot={false} name="New Users" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No data yet</div>
            )}
          </div>
        </PW>

        {/* Revenue per Day */}
        <PW id="chart_revenue" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Revenue (30 days)</h3>
            {revenueData?.revenueByDay?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenueData.revenueByDay.map(d => ({ ...d, date: formatDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
                  <XAxis dataKey="date" stroke="#5a5a78" fontSize={11} />
                  <YAxis stroke="#5a5a78" fontSize={11} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #8b5cf6', borderRadius: 6, fontSize: 12 }} formatter={v => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#ffd700" strokeWidth={2} dot={false} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No revenue data yet</div>
            )}
          </div>
        </PW>

        {/* Revenue by Item - Bar Chart */}
        <PW id="chart_revenue_item" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Revenue by Item</h3>
            {revenueData?.revenueByItem?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueData.revenueByItem.map(d => ({ ...d, name: ITEM_LABELS[d.item] || d.item }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
                  <XAxis dataKey="name" stroke="#5a5a78" fontSize={11} />
                  <YAxis stroke="#5a5a78" fontSize={11} tickFormatter={v => `$${v}`} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #8b5cf6', borderRadius: 6, fontSize: 12 }} formatter={v => [`$${Number(v).toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {revenueData.revenueByItem.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No item data yet</div>
            )}
          </div>
        </PW>

        {/* Active Users per Day */}
        <PW id="chart_active_users" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Active Users (30 days)</h3>
            {userData?.activeByDay?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={userData.activeByDay.map(d => ({ ...d, date: formatDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
                  <XAxis dataKey="date" stroke="#5a5a78" fontSize={11} />
                  <YAxis stroke="#5a5a78" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #8b5cf6', borderRadius: 6, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#00ff88" strokeWidth={2} dot={false} name="Active Users" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No activity data yet</div>
            )}
          </div>
        </PW>
      </div>

      {/* ================================================================
          SECTION 3: BUSINESS METRICS
          ================================================================ */}
      <h2 className="section-title">Business Metrics</h2>

      <div className="metrics-grid">
        {/* Revenue Metrics */}
        <PW id="metric_revenue" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Revenue Metrics</h3>
            <div className="card-stats">
              <div>
                <span className="stat-label">ARPU</span>
                <span className="stat-value text-accent">${revenueData?.arpu?.toFixed(2) || '0.00'}</span>
              </div>
              <div>
                <span className="stat-label">Avg Transaction</span>
                <span className="stat-value">${revenueData?.avgTransaction?.toFixed(2) || '0.00'}</span>
              </div>
              <div>
                <span className="stat-label">Total Transactions</span>
                <span className="stat-value">{overview.totalTransactions}</span>
              </div>
            </div>
          </div>
        </PW>

        {/* Conversion Rates */}
        <PW id="metric_conversion" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Conversion Rates</h3>
            <div className="card-stats">
              <div>
                <span className="stat-label">Free → Premium</span>
                <span className="stat-value">{userData?.conversionRates?.freeToPremium || 0}%</span>
              </div>
              <div>
                <span className="stat-label">Premium → Battle Pass</span>
                <span className="stat-value">{userData?.conversionRates?.premiumToBattlePass || 0}%</span>
              </div>
              <div>
                <span className="stat-label">Retention (next day)</span>
                <span className="stat-value">{userData?.retentionRate || 0}%</span>
              </div>
            </div>
          </div>
        </PW>

        {/* Referrals */}
        <PW id="metric_referrals" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Referrals</h3>
            <div className="card-stats">
              <div>
                <span className="stat-label">Total</span>
                <span className="stat-value">{engagement?.referrals?.total || 0}</span>
              </div>
              <div>
                <span className="stat-label">Verified</span>
                <span className="stat-value text-green">{engagement?.referrals?.verified || 0}</span>
              </div>
              <div>
                <span className="stat-label">Verification Rate</span>
                <span className="stat-value">{engagement?.referrals?.verificationRate || 0}%</span>
              </div>
            </div>
          </div>
        </PW>

        {/* Engagement */}
        <PW id="metric_engagement" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Engagement</h3>
            <div className="card-stats">
              <div>
                <span className="stat-label">Total Taps</span>
                <span className="stat-value">{(engagement?.totalTaps || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="stat-label">Avg Taps/User/Day</span>
                <span className="stat-value">{engagement?.avgTapsPerUserPerDay || 0}</span>
              </div>
            </div>
          </div>
        </PW>
      </div>

      {/* Level Distribution & Quest Completions side by side */}
      <div className="charts-grid">
        {/* Level Distribution */}
        <PW id="chart_levels" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Level Distribution</h3>
            {engagement?.levelDistribution?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={engagement.levelDistribution.map(d => ({ level: `Lv ${d.level}`, count: d.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e30" />
                  <XAxis dataKey="level" stroke="#5a5a78" fontSize={11} />
                  <YAxis stroke="#5a5a78" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#111118', border: '1px solid #8b5cf6', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Players" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No level data</div>
            )}
          </div>
        </PW>

        {/* Quest Completions */}
        <PW id="chart_quests" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Quest Completions</h3>
            {engagement?.questCompletions?.length > 0 ? (
              <div className="quest-completions-list">
                {engagement.questCompletions.map((q, i) => (
                  <div key={i} className="quest-completion-row">
                    <span className="quest-completion-title">{q.title}</span>
                    <div className="quest-completion-bar-track">
                      <div
                        className="quest-completion-bar-fill"
                        style={{
                          width: `${Math.min(100, (q.completions / Math.max(1, overview.totalUsers)) * 100)}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length]
                        }}
                      />
                    </div>
                    <span className="quest-completion-count">{q.completions}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="chart-empty">No quest data</div>
            )}
          </div>
        </PW>
      </div>

      {/* Revenue by Item Table */}
      {overview.revenueByItem.length > 0 && (
        <PW id="table_revenue" p={privacy} onToggle={togglePrivacy} editing={editingVisibility} pv={partnerView}>
          <div className="card">
            <h3 className="card-title">Revenue Breakdown</h3>
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Revenue</th>
                    <th>Sales</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.revenueByItem.map((item, i) => (
                    <tr key={i}>
                      <td>{ITEM_LABELS[item.item] || item.item}</td>
                      <td className="text-accent">${item.revenue.toFixed(2)}</td>
                      <td>{item.count}</td>
                      <td>{overview.revenueTotal > 0 ? ((item.revenue / overview.revenueTotal) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </PW>
      )}
    </div>
  )
}

// ============================================================================
// Privacy Wrapper - wraps each dashboard widget
// ============================================================================
function PW({ id, p, onToggle, editing, pv, children }) {
  const state = p[id] || 'visible'

  // Partner view (not editing): hidden items don't render at all
  if (pv && !editing && state === 'hidden') return null

  const isBlurred = (pv || editing) && state === 'blur'
  const isHidden = editing && state === 'hidden'

  return (
    <div style={{ position: 'relative', ...(isHidden ? { opacity: 0.15 } : {}) }}>
      {editing && (
        <button
          onClick={() => onToggle(id)}
          className="pw-toggle"
          style={{
            background: `${PRIVACY_COLOR[state]}18`,
            borderColor: PRIVACY_COLOR[state],
            color: PRIVACY_COLOR[state],
          }}
        >
          {PRIVACY_LABEL[state]}
        </button>
      )}
      <div style={isBlurred ? { filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none' } : {}}>
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// Stat Card
// ============================================================================
function StatCard({ label, value, accent, change, changePositive }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className={`stat-card-value ${accent ? 'text-accent' : ''}`}>{value}</div>
      {change && (
        <div className={`stat-card-change ${changePositive ? 'change-positive' : 'change-negative'}`}>
          {change}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'

const SOCIAL_TYPES = ['twitter_follow', 'twitter_like', 'twitter_retweet', 'telegram_join', 'discord_join']
const GAME_TYPES = ['tap_count', 'level_milestone', 'purchase']
const REFERRAL_TYPES = ['referral']

function getVerificationLabel(reqType) {
  if (SOCIAL_TYPES.includes(reqType)) return { icon: '\u{1F9E0}', label: 'Smart Verification (no API needed)' }
  if (reqType === 'partner_quest') return { icon: '\u{1F517}', label: 'API Verification (real)' }
  if (GAME_TYPES.includes(reqType)) return { icon: '\u{1F3AE}', label: 'Auto-verified' }
  if (REFERRAL_TYPES.includes(reqType)) return { icon: '\u{1F465}', label: 'Auto-verified' }
  return { icon: '\u{2753}', label: 'Unknown' }
}

export default function QuestManager({ apiCall }) {
  const [quests, setQuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editQuest, setEditQuest] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { loadQuests() }, [])

  const loadQuests = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/api/admin/quests')
      setQuests(data.quests)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleQuest = async (id) => {
    try {
      await apiCall(`/api/admin/quests/${id}/toggle`, { method: 'PATCH' })
      loadQuests()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const saveQuest = async (id, data) => {
    try {
      await apiCall(`/api/admin/quests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      setEditQuest(null)
      loadQuests()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  const createQuest = async (data) => {
    try {
      await apiCall('/api/admin/quests', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      setShowCreate(false)
      loadQuests()
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  if (loading) return <div className="page-loading">Loading quests...</div>
  if (error) return <div className="page-error">Error: {error}</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Quest Manager</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ New Quest</button>
      </div>
      <p className="page-subtitle">{quests.length} quests total</p>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th></th>
              <th>Title</th>
              <th>Type</th>
              <th>Verification</th>
              <th>Reward</th>
              <th>Done</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quests.map(quest => {
              const vl = getVerificationLabel(quest.requirement_type)
              return (
              <tr key={quest.id} className={!quest.is_active ? 'row-dimmed' : ''}>
                <td>{quest.id}</td>
                <td>{quest.icon}</td>
                <td className="font-bold">{quest.title}</td>
                <td><span className="badge">{quest.quest_type}</span></td>
                <td><span style={{ fontSize: 11 }}>{vl.icon} {vl.label}</span></td>
                <td>
                  {quest.reward_amount
                    ? <span className="text-accent">{Number(quest.reward_amount).toLocaleString()} XP</span>
                    : quest.requirement_type === 'partner_quest'
                      ? <span className="text-green">Boost</span>
                      : <span className="text-muted">TBA</span>
                  }
                </td>
                <td>{quest.completions}</td>
                <td>
                  <span className={`badge ${quest.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {quest.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-btns">
                    <button className="btn btn-sm" onClick={() => setEditQuest(quest)}>Edit</button>
                    <button
                      className={`btn btn-sm ${quest.is_active ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleQuest(quest.id)}
                    >
                      {quest.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editQuest && (
        <QuestEditModal
          quest={editQuest}
          onSave={(data) => saveQuest(editQuest.id, data)}
          onClose={() => setEditQuest(null)}
        />
      )}

      {showCreate && (
        <QuestCreateModal
          onSave={createQuest}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function QuestEditModal({ quest, onSave, onClose }) {
  const [title, setTitle] = useState(quest.title)
  const [description, setDescription] = useState(quest.description || '')
  const [icon, setIcon] = useState(quest.icon || '')
  const [xpReward, setXpReward] = useState(quest.reward_amount || '')
  const [externalUrl, setExternalUrl] = useState(quest.requirement_metadata?.url || '')
  const [sortOrder, setSortOrder] = useState(quest.sort_order || 0)
  const [apiEndpoint, setApiEndpoint] = useState(quest.requirement_metadata?.api_endpoint || '')
  const [apiMethod, setApiMethod] = useState(quest.requirement_metadata?.api_method || 'GET')
  const [successExpr, setSuccessExpr] = useState(quest.requirement_metadata?.success_expression || 'data.exists === true')
  const [boostPct, setBoostPct] = useState(quest.requirement_metadata?.boost_percentage || 20)
  const [boostDays, setBoostDays] = useState(quest.requirement_metadata?.boost_days || 30)
  const [saving, setSaving] = useState(false)

  const isPartner = quest.requirement_type === 'partner_quest'
  const vl = getVerificationLabel(quest.requirement_type)

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      title, description, icon,
      xp_reward: xpReward ? Number(xpReward) : null,
      external_url: externalUrl || null,
      sort_order: Number(sortOrder)
    }
    if (isPartner && apiEndpoint) {
      payload.partner_api_config = {
        api_endpoint: apiEndpoint,
        api_method: apiMethod,
        success_expression: successExpr,
        boost_percentage: Number(boostPct),
        boost_days: Number(boostDays),
        reward_type: 'boost'
      }
    }
    await onSave(payload)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Edit Quest #{quest.id}</h2>
        <p className="modal-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{vl.icon}</span> {vl.label}
        </p>

        <label className="form-label">Title</label>
        <input className="login-input" value={title} onChange={e => setTitle(e.target.value)} />

        <label className="form-label">Description</label>
        <input className="login-input" value={description} onChange={e => setDescription(e.target.value)} />

        <div className="form-row">
          <div>
            <label className="form-label">Icon</label>
            <input className="login-input" value={icon} onChange={e => setIcon(e.target.value)} style={{ width: 80 }} />
          </div>
          <div>
            <label className="form-label">XP Reward</label>
            <input className="login-input" type="number" value={xpReward} onChange={e => setXpReward(e.target.value)} style={{ width: 120 }} />
          </div>
          <div>
            <label className="form-label">Sort Order</label>
            <input className="login-input" type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ width: 80 }} />
          </div>
        </div>

        <label className="form-label">External URL (GO button link)</label>
        <input className="login-input" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." />

        {isPartner && (
          <>
            <label className="form-label" style={{ color: '#00ffff', marginTop: 18 }}>Partner API Configuration</label>
            <label className="form-label">API Endpoint URL (use {'{address}'} for wallet)</label>
            <input className="login-input" value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)} placeholder="https://api.partner.com/check/{address}" />
            <div className="form-row">
              <div>
                <label className="form-label">HTTP Method</label>
                <select className="login-input" value={apiMethod} onChange={e => setApiMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label className="form-label">Success Expression</label>
                <input className="login-input" value={successExpr} onChange={e => setSuccessExpr(e.target.value)} placeholder="data.exists === true" />
              </div>
            </div>
            <div className="form-row">
              <div>
                <label className="form-label">Boost %</label>
                <input className="login-input" type="number" value={boostPct} onChange={e => setBoostPct(e.target.value)} style={{ width: 80 }} />
              </div>
              <div>
                <label className="form-label">Boost Days</label>
                <input className="login-input" type="number" value={boostDays} onChange={e => setBoostDays(e.target.value)} style={{ width: 80 }} />
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestCreateModal({ onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('\u{1F3AF}')
  const [questType, setQuestType] = useState('social')
  const [requirementType, setRequirementType] = useState('twitter_follow')
  const [requirementValue, setRequirementValue] = useState(1)
  const [rewardAmount, setRewardAmount] = useState(500)
  const [externalUrl, setExternalUrl] = useState('')
  // Partner API fields
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiMethod, setApiMethod] = useState('GET')
  const [successExpr, setSuccessExpr] = useState('data.exists === true')
  const [rewardType, setRewardType] = useState('xp')
  const [boostPct, setBoostPct] = useState(20)
  const [boostDays, setBoostDays] = useState(30)
  const [saving, setSaving] = useState(false)

  const isPartner = requirementType === 'partner_quest'
  const isSocial = SOCIAL_TYPES.includes(requirementType)
  const isGame = GAME_TYPES.includes(requirementType)
  const isReferral = REFERRAL_TYPES.includes(requirementType)

  // Auto-set quest type when requirement changes
  const handleReqTypeChange = (val) => {
    setRequirementType(val)
    if (SOCIAL_TYPES.includes(val)) setQuestType('social')
    else if (val === 'partner_quest') setQuestType('partner')
    else if (REFERRAL_TYPES.includes(val)) setQuestType('achievement')
    else setQuestType('game')
  }

  const vl = getVerificationLabel(requirementType)

  const handleSave = async () => {
    if (!title.trim()) { alert('Title required'); return }
    setSaving(true)

    const metadata = {}
    if (externalUrl) metadata.url = externalUrl
    if (isPartner && apiEndpoint) {
      metadata.api_endpoint = apiEndpoint
      metadata.api_method = apiMethod
      metadata.success_expression = successExpr
      if (rewardType === 'boost') {
        metadata.reward_type = 'boost'
        metadata.boost_percentage = Number(boostPct)
        metadata.boost_days = Number(boostDays)
      }
    }

    await onSave({
      title: title.trim(),
      description: description.trim(),
      icon,
      quest_type: questType,
      requirement_type: requirementType,
      requirement_value: Number(requirementValue),
      reward_amount: rewardType === 'xp' ? Number(rewardAmount) : 0,
      external_url: externalUrl || null,
      requirement_metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      sort_order: 99
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create New Quest</h2>

        <label className="form-label">Requirement Type</label>
        <select className="login-input" value={requirementType} onChange={e => handleReqTypeChange(e.target.value)}>
          <optgroup label="Social (Smart Verification)">
            <option value="twitter_follow">Twitter Follow</option>
            <option value="twitter_like">Twitter Like</option>
            <option value="twitter_retweet">Twitter Retweet</option>
            <option value="telegram_join">Telegram Join</option>
            <option value="discord_join">Discord Join</option>
          </optgroup>
          <optgroup label="Game (Auto-verified)">
            <option value="tap_count">Tap Count</option>
            <option value="level_milestone">Level Milestone</option>
            <option value="purchase">Purchase</option>
          </optgroup>
          <optgroup label="Referral (Auto-verified)">
            <option value="referral">Referral</option>
          </optgroup>
          <optgroup label="Partner (API Verification)">
            <option value="partner_quest">Partner Quest</option>
          </optgroup>
        </select>

        <div style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.08)', borderRadius: 6, margin: '8px 0', fontSize: 11 }}>
          {vl.icon} {vl.label}
        </div>

        <label className="form-label">Title *</label>
        <input className="login-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

        <label className="form-label">Description</label>
        <input className="login-input" value={description} onChange={e => setDescription(e.target.value)} />

        <div className="form-row">
          <div>
            <label className="form-label">Icon</label>
            <input className="login-input" value={icon} onChange={e => setIcon(e.target.value)} style={{ width: 80 }} />
          </div>
          {(isGame || isReferral) && (
            <div>
              <label className="form-label">Target Value</label>
              <input className="login-input" type="number" value={requirementValue} onChange={e => setRequirementValue(e.target.value)} style={{ width: 100 }} />
            </div>
          )}
        </div>

        {(isSocial || isPartner) && (
          <>
            <label className="form-label">External URL (GO button link)</label>
            <input className="login-input" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://twitter.com/..." />
          </>
        )}

        {isPartner && (
          <>
            <label className="form-label" style={{ color: '#00ffff', marginTop: 18 }}>Partner API Config</label>
            <label className="form-label">API Endpoint (use {'{address}'} for wallet)</label>
            <input className="login-input" value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)} placeholder="https://api.partner.com/users/check/{address}" />
            <div className="form-row">
              <div>
                <label className="form-label">Method</label>
                <select className="login-input" value={apiMethod} onChange={e => setApiMethod(e.target.value)}>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label className="form-label">Success Expression</label>
                <input className="login-input" value={successExpr} onChange={e => setSuccessExpr(e.target.value)} />
              </div>
            </div>

            <label className="form-label">Reward Type</label>
            <select className="login-input" value={rewardType} onChange={e => setRewardType(e.target.value)}>
              <option value="xp">XP Amount</option>
              <option value="boost">Tap Boost (% + days)</option>
            </select>

            {rewardType === 'boost' && (
              <div className="form-row">
                <div>
                  <label className="form-label">Boost %</label>
                  <input className="login-input" type="number" value={boostPct} onChange={e => setBoostPct(e.target.value)} style={{ width: 80 }} />
                </div>
                <div>
                  <label className="form-label">Duration (days)</label>
                  <input className="login-input" type="number" value={boostDays} onChange={e => setBoostDays(e.target.value)} style={{ width: 80 }} />
                </div>
              </div>
            )}
          </>
        )}

        {rewardType === 'xp' && (
          <>
            <label className="form-label">XP Reward</label>
            <input className="login-input" type="number" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} />
          </>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? 'Creating...' : 'Create Quest'}
          </button>
        </div>
      </div>
    </div>
  )
}

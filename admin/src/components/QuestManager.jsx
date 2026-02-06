import { useState, useEffect } from 'react'

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
              <th>Requirement</th>
              <th>Reward</th>
              <th>Completions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quests.map(quest => (
              <tr key={quest.id} className={!quest.is_active ? 'row-dimmed' : ''}>
                <td>{quest.id}</td>
                <td>{quest.icon}</td>
                <td className="font-bold">{quest.title}</td>
                <td><span className="badge">{quest.quest_type}</span></td>
                <td>
                  <span className="text-muted">{quest.requirement_type}</span>
                  {quest.requirement_value > 1 && <span className="text-muted"> ({quest.requirement_value})</span>}
                </td>
                <td>
                  {quest.reward_amount
                    ? <span className="text-accent">{Number(quest.reward_amount).toLocaleString()} XP</span>
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editQuest && (
        <QuestEditModal
          quest={editQuest}
          onSave={(data) => saveQuest(editQuest.id, data)}
          onClose={() => setEditQuest(null)}
        />
      )}

      {/* Create Modal */}
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
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave({
      title,
      description,
      icon,
      xp_reward: xpReward ? Number(xpReward) : null,
      external_url: externalUrl || null,
      sort_order: Number(sortOrder)
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Edit Quest #{quest.id}</h2>

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

        <label className="form-label">External URL</label>
        <input className="login-input" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." />

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
  const [icon, setIcon] = useState('🎯')
  const [questType, setQuestType] = useState('social')
  const [requirementType, setRequirementType] = useState('twitter_follow')
  const [requirementValue, setRequirementValue] = useState(1)
  const [rewardAmount, setRewardAmount] = useState(500)
  const [externalUrl, setExternalUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) { alert('Title required'); return }
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim(),
      icon,
      quest_type: questType,
      requirement_type: requirementType,
      requirement_value: Number(requirementValue),
      reward_amount: Number(rewardAmount),
      external_url: externalUrl || null,
      sort_order: 99
    })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create New Quest</h2>

        <label className="form-label">Title *</label>
        <input className="login-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

        <label className="form-label">Description</label>
        <input className="login-input" value={description} onChange={e => setDescription(e.target.value)} />

        <div className="form-row">
          <div>
            <label className="form-label">Icon</label>
            <input className="login-input" value={icon} onChange={e => setIcon(e.target.value)} style={{ width: 80 }} />
          </div>
          <div>
            <label className="form-label">Type</label>
            <select className="login-input" value={questType} onChange={e => setQuestType(e.target.value)}>
              <option value="social">Social</option>
              <option value="game">Game</option>
              <option value="achievement">Achievement</option>
              <option value="partner">Partner</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label className="form-label">Requirement Type</label>
            <select className="login-input" value={requirementType} onChange={e => setRequirementType(e.target.value)}>
              <option value="twitter_follow">Twitter Follow</option>
              <option value="twitter_like">Twitter Like</option>
              <option value="twitter_retweet">Twitter Retweet</option>
              <option value="telegram_join">Telegram Join</option>
              <option value="discord_join">Discord Join</option>
              <option value="tap_count">Tap Count</option>
              <option value="level_milestone">Level Milestone</option>
              <option value="referral">Referral</option>
              <option value="purchase">Purchase</option>
              <option value="partner_quest">Partner Quest</option>
            </select>
          </div>
          <div>
            <label className="form-label">Req. Value</label>
            <input className="login-input" type="number" value={requirementValue} onChange={e => setRequirementValue(e.target.value)} style={{ width: 100 }} />
          </div>
          <div>
            <label className="form-label">XP Reward</label>
            <input className="login-input" type="number" value={rewardAmount} onChange={e => setRewardAmount(e.target.value)} style={{ width: 120 }} />
          </div>
        </div>

        <label className="form-label">External URL</label>
        <input className="login-input" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://..." />

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

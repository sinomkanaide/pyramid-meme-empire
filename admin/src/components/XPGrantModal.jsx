import { useState } from 'react'

// Simple level calculation matching backend formula: XP_required = 100 * (level^1.5)
function calculateLevelFromXp(totalXp) {
  let level = 1
  let xpNeeded = 0
  while (true) {
    const nextLevelXp = Math.floor(100 * Math.pow(level, 1.5))
    if (xpNeeded + nextLevelXp > totalXp) break
    xpNeeded += nextLevelXp
    level++
  }
  return level
}

export default function XPGrantModal({ user, onGrant, onClose }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const parsedAmount = parseInt(amount) || 0
  const currentBricks = user?.bricks || 0
  const newTotal = currentBricks + parsedAmount
  const currentLevel = user?.level || 1
  const newLevel = parsedAmount > 0 ? calculateLevelFromXp(newTotal) : currentLevel

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (parsedAmount <= 0) {
      setError('Enter a valid XP amount')
      return
    }
    if (!reason.trim()) {
      setError('Reason is required for audit log')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onGrant(parsedAmount, reason.trim())
      onClose()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Grant XP</h2>
        <p className="modal-subtitle">User: {truncate(user?.wallet_address)} (ID: {user?.id})</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className="form-label">XP Amount</label>
          <input
            type="number"
            className="login-input"
            placeholder="e.g. 500"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            autoFocus
          />

          <label className="form-label">Reason (required for audit)</label>
          <select
            className="login-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ marginBottom: 4 }}
          >
            <option value="">Select a reason...</option>
            <option value="AMA winner">AMA winner</option>
            <option value="Bug reporter">Bug reporter</option>
            <option value="Community contributor">Community contributor</option>
            <option value="Contest winner">Contest winner</option>
            <option value="Compensation">Compensation</option>
            <option value="Custom">Custom (type below)</option>
          </select>
          {reason === 'Custom' && (
            <input
              type="text"
              className="login-input"
              placeholder="Enter custom reason..."
              onChange={(e) => setReason(e.target.value)}
            />
          )}

          {parsedAmount > 0 && (
            <div className="grant-preview">
              <div className="grant-preview-row">
                <span>XP to grant:</span>
                <strong className="text-accent">+{parsedAmount.toLocaleString()}</strong>
              </div>
              <div className="grant-preview-row">
                <span>Current XP:</span>
                <span>{currentBricks.toLocaleString()}</span>
              </div>
              <div className="grant-preview-row">
                <span>New total:</span>
                <strong>{newTotal.toLocaleString()}</strong>
              </div>
              {newLevel > currentLevel && (
                <div className="grant-preview-row grant-level-up">
                  <span>Level up!</span>
                  <strong>Lv {currentLevel} → Lv {newLevel}</strong>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || parsedAmount <= 0 || !reason.trim()}>
              {loading ? 'Granting...' : 'Confirm Grant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

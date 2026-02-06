import { useState } from 'react'
import { ethers } from 'ethers'

export default function Login({ apiUrl, onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [walletAddress, setWalletAddress] = useState(null)

  const connectWallet = async () => {
    setError('')
    if (!window.ethereum) {
      setError('MetaMask not found. Please install MetaMask.')
      return
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      if (accounts.length > 0) {
        setWalletAddress(accounts[0])
      }
    } catch (err) {
      setError('Failed to connect wallet')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!walletAddress) {
      setError('Connect wallet first')
      return
    }
    if (!password) {
      setError('Enter password')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: walletAddress, password })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }

      onLogin(data.token, walletAddress)
    } catch (err) {
      setError(`Connection error: ${err.message}. API: ${apiUrl}`)
      setLoading(false)
    }
  }

  const truncateWallet = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">PME</div>
        <h1 className="login-title">Admin Panel</h1>
        <p className="login-subtitle">Pyramid Meme Empire</p>

        {error && <div className="login-error">{error}</div>}

        <div className="login-form">
          {!walletAddress ? (
            <button className="btn btn-primary btn-full" onClick={connectWallet}>
              Connect Wallet
            </button>
          ) : (
            <>
              <div className="login-wallet-badge">
                <span className="wallet-dot" />
                {truncateWallet(walletAddress)}
              </div>

              <form onSubmit={handleLogin}>
                <input
                  type="password"
                  className="login-input"
                  placeholder="Admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                >
                  {loading ? 'Authenticating...' : 'Login'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

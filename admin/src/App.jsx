import { useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import QuestManager from './components/QuestManager'
import UserManager from './components/UserManager'
import LeaderboardManager from './components/LeaderboardManager'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.tapkamun.fun'

function App() {
  // Token stored in memory only (not localStorage) for security
  const [token, setToken] = useState(null)
  const [adminWallet, setAdminWallet] = useState(null)

  const handleLogin = useCallback((jwt, wallet) => {
    setToken(jwt)
    setAdminWallet(wallet)
  }, [])

  const handleLogout = useCallback(() => {
    setToken(null)
    setAdminWallet(null)
  }, [])

  // API helper with admin token
  const apiCall = useCallback(async (endpoint, options = {}) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (res.status === 401 || res.status === 403) {
      setToken(null)
      setAdminWallet(null)
      throw new Error('Session expired')
    }

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [token])

  // Not logged in → show Login
  if (!token) {
    return <Login apiUrl={API_URL} onLogin={handleLogin} />
  }

  // Logged in → show admin panel
  return (
    <div className="admin-layout">
      <Sidebar wallet={adminWallet} onLogout={handleLogout} />
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<Dashboard apiCall={apiCall} />} />
          <Route path="/quests" element={<QuestManager apiCall={apiCall} />} />
          <Route path="/users" element={<UserManager apiCall={apiCall} />} />
          <Route path="/leaderboard" element={<LeaderboardManager apiCall={apiCall} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App

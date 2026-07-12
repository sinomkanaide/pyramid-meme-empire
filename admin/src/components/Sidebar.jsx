import { NavLink } from 'react-router-dom'

export default function Sidebar({ wallet, onLogout }) {
  const truncate = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">KAMUN</div>
        <span className="sidebar-title">Admin</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">📊</span>
          Dashboard
        </NavLink>
        <NavLink to="/quests" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">🎯</span>
          Quests
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">👥</span>
          Users
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">🏆</span>
          Leaderboard
        </NavLink>
        <NavLink to="/refunds" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <span className="sidebar-icon">💸</span>
          Refunds
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-wallet">{truncate(wallet)}</div>
        <button className="btn btn-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  )
}

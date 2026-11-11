import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useMatches } from '../lib/useMatches'
import { useUnreadCounts } from '../lib/useUnreadCounts'
import Wordmark from './Wordmark'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { matches } = useMatches(profile?.role, profile?.id)
  const unreadCounts = useUnreadCounts(matches, profile?.id)
  const unreadTotal = Object.values(unreadCounts).reduce((total, count) => total + count, 0)
  const canMessage = profile?.role === 'student' || profile?.role === 'mentor'

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/dashboard" className="no-underline">
            <Wordmark />
          </Link>
          <nav className="topnav" aria-label="Main">
            <NavLink to="/dashboard">Dashboard</NavLink>
            {canMessage && <NavLink to="/matching">Matching</NavLink>}
            {canMessage && <NavLink to="/schedule">Schedule</NavLink>}
            {canMessage && (
              <NavLink to="/messages" className="nav-messages">
                Messages
                {unreadTotal > 0 && <span className="unread-badge" aria-label={`${unreadTotal} unread`}>{unreadTotal}</span>}
              </NavLink>
            )}
            <NavLink to="/profile">Profile</NavLink>
            <NavLink to="/account">Account</NavLink>
            {profile?.role === 'admin' && <NavLink to="/admin">Matching</NavLink>}
          </nav>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>
      <main className="wrap page">
        <Outlet context={{ unreadCounts }} />
      </main>
    </>
  )
}

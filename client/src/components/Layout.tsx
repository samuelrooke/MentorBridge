import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useViewer } from '../context/viewer'
import { useMatches } from '../lib/useMatches'
import { useUnreadCounts } from '../lib/useUnreadCounts'
import ViewAsSwitcher from './ViewAsSwitcher'
import Wordmark from './Wordmark'

const roleNames = { student: 'student', mentor: 'mentor', company: 'company', admin: 'admin' }

export default function Layout() {
  const { signOut } = useAuth()
  // The menu follows whoever the app is showing, so an admin viewing as a student
  // gets exactly the student's menu (plus the "View as" switch).
  const { viewer, viewingAs, isAdmin, setViewingAs } = useViewer()
  const navigate = useNavigate()
  const { matches } = useMatches(viewer?.role, viewer?.id)
  const unreadCounts = useUnreadCounts(matches, viewer?.id)
  const unreadTotal = Object.values(unreadCounts).reduce((total, count) => total + count, 0)
  const role = viewer?.role
  const hasMatchPages = role === 'student' || role === 'mentor' || role === 'admin'

  function backToAdmin() {
    setViewingAs(null)
    navigate('/dashboard')
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/dashboard" className="no-underline">
            <Wordmark />
          </Link>
          <nav className="topnav" aria-label="Main">
            <NavLink to="/dashboard">Dashboard</NavLink>
            {(role === 'student' || role === 'mentor') && <NavLink to="/matching">Matching</NavLink>}
            {hasMatchPages && <NavLink to="/schedule">Schedule</NavLink>}
            {hasMatchPages && (
              <NavLink to="/messages" className="nav-messages">
                Messages
                {unreadTotal > 0 && <span className="unread-badge" aria-label={`${unreadTotal} unread`}>{unreadTotal}</span>}
              </NavLink>
            )}
            {!viewingAs && role !== 'admin' && <NavLink to="/profile">Profile</NavLink>}
            {!viewingAs && <NavLink to="/account">Account</NavLink>}
          </nav>
          {isAdmin && <ViewAsSwitcher />}
          <button className="btn btn-ghost btn-sm" onClick={signOut}>
            Log out
          </button>
        </div>
      </header>
      {viewingAs && (
        <div className="view-as-banner" role="status">
          <div className="wrap view-as-banner-inner">
            <p>
              Viewing as <strong>{viewingAs.full_name || viewingAs.email}</strong> ({roleNames[viewingAs.role]}). You see what
              they see. Changes are made by your admin account, and messages are posted as MentorBridge team.
            </p>
            <button className="btn btn-sm btn-on-dark" onClick={backToAdmin}>Back to admin view</button>
          </div>
        </div>
      )}
      <main className="wrap page">
        <Outlet context={{ unreadCounts }} />
      </main>
    </>
  )
}

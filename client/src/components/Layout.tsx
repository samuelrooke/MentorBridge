import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Wordmark from './Wordmark'

export default function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <Link to="/dashboard" className="no-underline">
            <Wordmark />
          </Link>
          <nav className="topnav" aria-label="Main">
            <NavLink to="/dashboard">Dashboard</NavLink>
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
        <Outlet />
      </main>
    </>
  )
}

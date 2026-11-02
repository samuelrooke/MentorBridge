import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/auth'

export default function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <>
      <header className="topbar">
        <Link to="/dashboard" className="wordmark">MentorBridge</Link>
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Profile</Link>
          {profile?.role === 'admin' && <Link to="/admin">Matching</Link>}
          <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}

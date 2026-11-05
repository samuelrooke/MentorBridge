import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'

const roleNames = { student: 'Student', company: 'Organization', mentor: 'Mentor', admin: 'Admin' }

export default function Dashboard() {
  const { session, profile } = useAuth()

  return (
    <div className="stack">
      <section className="card stack-sm">
        <p className="badge">Logged in</p>
        <h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <p className="muted">
          You are logged in as <strong>{session?.user.email}</strong>
          {profile && <> ({roleNames[profile.role]})</>}.
        </p>
      </section>

      <div className="tiles">
        <Link to="/profile" className="card tile">
          <h2>Profile</h2>
          <p className="muted">Your field, internship and what you want help with.</p>
        </Link>
        <Link to="/account" className="card tile">
          <h2>Account</h2>
          <p className="muted">Your login details, and logging out.</p>
        </Link>
      </div>
    </div>
  )
}

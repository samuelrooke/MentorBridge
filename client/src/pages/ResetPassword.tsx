import { Link, useNavigate } from 'react-router-dom'
import PasswordForm from '../components/PasswordForm'
import Wordmark from '../components/Wordmark'
import { useAuth } from '../context/auth'

// Opened from the "set a new password" email. Supabase reads the link and logs
// the user in, after which they can choose a new password here.
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  return (
    <main className="auth-page">
      <div className="auth-intro">
        <Wordmark />
        <h1>Choose a new password.</h1>
      </div>

      <div className="card auth-card">
        {loading ? (
          <p className="muted">Checking your link…</p>
        ) : session ? (
          <>
            <div className="stack-sm">
              <h2>Set a new password</h2>
              <p className="muted">For {session.user.email}. Use at least 8 characters.</p>
            </div>
            <PasswordForm submitLabel="Save and continue" onDone={() => setTimeout(() => navigate('/dashboard'), 1200)} />
          </>
        ) : (
          <div className="stack-sm">
            <h2>This link doesn&rsquo;t work any more</h2>
            <p className="muted">Reset links can only be used once and expire after a while. Ask for a new one.</p>
            <Link to="/login" className="btn btn-primary">
              Back to log in
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}

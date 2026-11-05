import PasswordForm from '../components/PasswordForm'
import { useAuth } from '../context/auth'

export default function Account() {
  const { session, profile, signOut } = useAuth()

  return (
    <section className="card stack">
      <div className="stack-sm">
        <p className="badge">Logged in</p>
        <h1>Account</h1>
      </div>
      <dl className="details">
        <dt>Email</dt>
        <dd>{session?.user.email}</dd>
        <dt>Name</dt>
        <dd>{profile?.full_name ?? '–'}</dd>
        <dt>Role</dt>
        <dd>{profile?.role ?? '–'}</dd>
        <dt>Member since</dt>
        <dd>{profile ? new Date(profile.created_at).toLocaleDateString('en-GB') : '–'}</dd>
      </dl>
      <div className="stack-sm border-t border-ink/10 pt-6">
        <h2>Change password</h2>
        <PasswordForm submitLabel="Save new password" />
      </div>
      <button type="button" className="btn btn-ghost self-start" onClick={signOut}>
        Log out
      </button>
    </section>
  )
}

import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Wordmark from '../components/Wordmark'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup' | 'forgot'
type SignupRole = 'student' | 'company' | 'mentor'

const roleLabels: Record<SignupRole, string> = {
  student: 'Student preparing for an internship',
  company: 'Organization hosting an intern',
  mentor: 'Professional who wants to mentor',
}

// Supabase's error messages are technical; these say what to do instead.
function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Check them, or reset your password.'
  if (/email not confirmed/i.test(message)) return 'Confirm your email first: click the link we sent you (check your spam folder too).'
  if (/already registered/i.test(message)) return 'There is already an account with this email. Log in, or reset your password.'
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a few minutes and try again.'
  if (/password should be at least/i.test(message)) return 'Your password needs at least 8 characters.'
  return message
}

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<SignupRole>('student')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'
  if (session) return <Navigate to={from} replace />

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
    setUnconfirmed(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    setUnconfirmed(false)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(friendlyError(error.message))
        setUnconfirmed(/email not confirmed/i.test(error.message))
      }
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role, full_name: fullName },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) setError(friendlyError(error.message))
      else if (!data.session) setInfo('Almost done: check your email and click the link to confirm your account.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      // Same message whether or not the address has an account, so it can't be used to check emails.
      if (error) setError(friendlyError(error.message))
      else setInfo('If there is an account with this email, we’ve sent a link to set a new password. Check your spam folder too.')
    }
    setBusy(false)
  }

  async function resendConfirmation() {
    setBusy(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setBusy(false)
    if (error) setError(friendlyError(error.message))
    else {
      setError(null)
      setUnconfirmed(false)
      setInfo('We’ve sent a new confirmation email. Check your spam folder too.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <Wordmark />
        <h1>Start your internship prepared.</h1>
        <p>Students, organizations and experienced professionals, working together before the first day.</p>
      </div>

      <form className="card auth-card" onSubmit={handleSubmit}>
        {mode === 'forgot' ? (
          <div className="stack-sm">
            <h2>Reset your password</h2>
            <p className="muted">Enter your email and we&rsquo;ll send you a link to set a new password.</p>
          </div>
        ) : (
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => switchMode('login')}>
              Log in
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => switchMode('signup')}>
              Create account
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <>
            <label>
              Full name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
            </label>
            <fieldset>
              <legend>I am a…</legend>
              {(Object.keys(roleLabels) as SignupRole[]).map((r) => (
                <label key={r} className="radio">
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                  {roleLabels[r]}
                </label>
              ))}
            </fieldset>
          </>
        )}

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>

        {mode !== 'forgot' && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <p>{error}</p>
            {unconfirmed && (
              <button type="button" className="link-button" onClick={resendConfirmation} disabled={busy}>
                Send the confirmation email again
              </button>
            )}
          </div>
        )}
        {info && (
          <p className="alert alert-info" role="status">
            {info}
          </p>
        )}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>

        {mode === 'login' && (
          <button type="button" className="link-button self-center" onClick={() => switchMode('forgot')}>
            Forgot your password?
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="link-button self-center" onClick={() => switchMode('login')}>
            Back to log in
          </button>
        )}
      </form>
    </div>
  )
}

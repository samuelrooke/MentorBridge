import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Wordmark from '../components/Wordmark'
import { api } from '../lib/api'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

// The app runs on mentorbridge.nl next to the landing pages, so "/" is the homepage.
// Locally the landing runs on its own port: set VITE_LANDING_URL=http://localhost:5174.
const landingUrl = import.meta.env.VITE_LANDING_URL || '/'
const privacyUrl = `${landingUrl.replace(/\/$/, '')}/privacy/`

type Mode = 'login' | 'signup' | 'forgot'
type SignupRole = 'student' | 'mentor' | 'company'

const roles: { value: SignupRole; title: string; hint: string }[] = [
  { value: 'student', title: 'Student', hint: 'I want a mentor before my internship' },
  { value: 'mentor', title: 'Mentor', hint: 'I want to help a student next to my job' },
  { value: 'company', title: 'Company', hint: 'We host interns or want to supply mentors' },
]

function isSignupRole(value: string | null): value is SignupRole {
  return value === 'student' || value === 'mentor' || value === 'company'
}

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roleParam = searchParams.get('role')
  // Links from the landing page can open sign-up with a role already chosen: /login?role=mentor
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' || isSignupRole(roleParam) ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [role, setRole] = useState<SignupRole>(isSignupRole(roleParam) ? roleParam : 'student')
  const [company, setCompany] = useState('')
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
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(friendlyError(error))
        setUnconfirmed(/email not confirmed/i.test(error.message))
      }
    } else if (mode === 'signup') {
      // The server creates the account and returns a one-time login (/auth/confirm), so the
      // person is logged in straight away and lands on the profile questions. No email is
      // sent, which avoids Supabase's limit of a few emails an hour.
      try {
        const { next } = await api<{ next: string | null }>('/signup', {
          method: 'POST',
          body: JSON.stringify({ role, first_name: firstName, last_name: surname, email, password, company }),
        })
        if (next) {
          navigate(next)
          return
        }
      } catch (signupError) {
        const message = (signupError as Error).message
        // Server messages are written for people; connection problems get the friendly text.
        setError(/failed to fetch|network|load failed/i.test(message) ? friendlyError(signupError) : message)
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      // Same message whether or not the address has an account, so it can't be used to check emails.
      if (error) setError(friendlyError(error))
      else setInfo('If there is an account with this email, we’ve sent a link to set a new password. Check your spam folder too.')
    }
    setBusy(false)
  }

  async function resendConfirmation() {
    setBusy(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    setBusy(false)
    if (error) setError(friendlyError(error))
    else {
      setError(null)
      setUnconfirmed(false)
      setInfo('We’ve sent a new email. Check your spam folder too.')
    }
  }

  const intro = mode === 'signup'
    ? { title: 'Join MentorBridge.', text: 'It takes a minute. Free for students, mentors and companies in the first version.' }
    : { title: 'Welcome back.', text: 'Log in to see your match, your sessions and your messages.' }

  return (
    <main className="auth-page">
      <div className="auth-intro">
        <a className="back-link" href={landingUrl}>
          <span aria-hidden="true">←</span> Back to the homepage
        </a>
        <Wordmark />
        <h1>{intro.title}</h1>
        <p>{intro.text}</p>
      </div>

      <form className="card auth-card" onSubmit={handleSubmit}>
          {mode === 'forgot' ? (
            <div className="stack-sm">
              <h2>Reset your password</h2>
              <p className="muted">Enter your email and we&rsquo;ll send you a link to set a new password.</p>
            </div>
          ) : (
            <div className="tabs" role="group" aria-label="Log in or create an account">
              <button type="button" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>
                Create account
              </button>
              <button type="button" aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>
                Log in
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <>
              <fieldset className="role-picker">
                <legend>I am a</legend>
                {roles.map((r) => (
                  <label key={r.value} className="radio role-option">
                    <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                    <span><strong>{r.title}</strong><span className="muted">{r.hint}</span></span>
                  </label>
                ))}
              </fieldset>
              <div className="name-fields">
                <label>
                  First name
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required maxLength={60} autoComplete="given-name" />
                </label>
                <label>
                  Surname
                  <input value={surname} onChange={(e) => setSurname(e.target.value)} required maxLength={60} autoComplete="family-name" />
                </label>
              </div>
              {role === 'company' && (
                <label>
                  Company name
                  <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={200} autoComplete="organization" />
                </label>
              )}
            </>
          )}

          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
          </label>

          {mode !== 'forgot' && (
            <div className="password-field">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-pressed={showPassword}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {mode === 'signup' && <span id="password-hint" className="field-hint">At least 8 characters.</span>}
            </div>
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

          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </button>

          {mode === 'signup' && (
            <p className="field-hint self-center">
              How we handle your details: <a href={privacyUrl}>privacy statement</a>.
            </p>
          )}
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
    </main>
  )
}

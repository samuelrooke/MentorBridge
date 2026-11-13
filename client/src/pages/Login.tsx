import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/auth'
import Wordmark from '../components/Wordmark'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

// The app runs on mentorbridge.nl next to the landing pages, so "/" is the homepage.
// Locally the landing runs on its own port: set VITE_LANDING_URL=http://localhost:5174.
const landingUrl = import.meta.env.VITE_LANDING_URL || '/'

type Mode ='login' | 'signup' | 'forgot' | 'check-email'
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
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [justSignedUp, setJustSignedUp] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/dashboard'
  // New accounts go straight to the short profile questions; returning users go where they were heading.
  if (session) return <Navigate to={justSignedUp ? '/profile?welcome=1' : from} replace />

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
      setJustSignedUp(true)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            role,
            first_name: firstName.trim(),
            last_name: surname.trim(),
            full_name: `${firstName.trim()} ${surname.trim()}`.trim(),
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })
      if (error) {
        setJustSignedUp(false)
        setError(friendlyError(error))
      } else if (data.user && data.user.identities?.length === 0) {
        // One account per email. With email confirmation on, Supabase answers a sign-up for an
        // existing address with a fake success and no email (so addresses can't be probed).
        // An empty identities list is the sign of that, so say it plainly instead.
        setJustSignedUp(false)
        setError('There is already an account with this email. Log in, or reset your password.')
      } else if (!data.session) {
        // Email confirmation is on: show a clear "check your inbox" step instead of a small note.
        setMode('check-email')
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

      {mode === 'check-email' ? (
        <section className="card auth-card" aria-live="polite">
          <div className="stack-sm">
            <h2>Check your inbox</h2>
            <p>We sent a link to <strong>{email.trim()}</strong>. Click it to confirm your email and you&rsquo;re in.</p>
            <p className="muted">It can take a few minutes. Check your spam folder too.</p>
          </div>
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {info && <p className="alert alert-info" role="status">{info}</p>}
          <button type="button" className="btn btn-ghost" onClick={resendConfirmation} disabled={busy}>
            {busy ? 'Please wait…' : 'Send the email again'}
          </button>
          <button type="button" className="link-button self-center" onClick={() => { setJustSignedUp(false); switchMode('signup') }}>
            Wrong email? Start again
          </button>
        </section>
      ) : (
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
      )}
    </main>
  )
}

import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'
type SignupRole = 'student' | 'company' | 'mentor'

const roleLabels: Record<SignupRole, string> = {
  student: 'Student preparing for an internship',
  company: 'Company hosting an intern',
  mentor: 'Professional who wants to mentor',
}

export default function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<SignupRole>('student')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'
  if (session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role, full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Check your email to confirm your account, then log in.')
    }
    setBusy(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <span className="wordmark">MentorBridge</span>
        <h1>Start your internship prepared.</h1>
        <p>Students, companies and experienced professionals, working together before the first day.</p>
      </div>

      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
            Create account
          </button>
        </div>

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

        {error && <p className="alert alert-error">{error}</p>}
        {info && <p className="alert alert-info">{info}</p>}

        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

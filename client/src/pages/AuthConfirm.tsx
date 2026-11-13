import type { EmailOtpType } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Wordmark from '../components/Wordmark'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'

const otpTypes: EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change', 'invite', 'magiclink']

// Where each kind of email link should land after it is confirmed.
const nextPage: Partial<Record<EmailOtpType, string>> = {
  signup: '/profile?welcome=1',
  email: '/profile?welcome=1',
  invite: '/profile?welcome=1',
  recovery: '/reset-password',
  email_change: '/account',
}

// The MentorBridge email templates (supabase/templates/) link here, on our own
// domain, instead of to the database host. This page confirms the token.
export default function AuthConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const started = useRef(false)
  const tokenHash = searchParams.get('token_hash')
  const typeParam = searchParams.get('type') as EmailOtpType | null
  const type = typeParam && otpTypes.includes(typeParam) ? typeParam : null
  const error = !tokenHash || !type
    ? 'This link is incomplete. Copy the whole link from the email, or ask for a new one.'
    : verifyError

  useEffect(() => {
    // React runs effects twice in development; a token can only be used once.
    if (started.current || !tokenHash || !type) return
    started.current = true
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error: otpError }) => {
      if (otpError) setVerifyError(friendlyError(otpError))
      else navigate(nextPage[type] ?? '/dashboard', { replace: true })
    })
  }, [navigate, tokenHash, type])

  return (
    <main className="auth-page">
      <div className="auth-intro">
        <Wordmark />
        <h1>{error ? 'That didn’t work.' : 'One moment.'}</h1>
      </div>
      <section className="card auth-card" aria-live="polite">
        {error ? (
          <div className="stack-sm">
            <p className="alert alert-error" role="alert">{error}</p>
            <Link to="/login" className="btn btn-primary">Back to log in</Link>
          </div>
        ) : (
          <p className="muted">Confirming your email…</p>
        )}
      </section>
    </main>
  )
}

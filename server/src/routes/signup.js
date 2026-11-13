import { Router } from 'express'
import { supabaseAdmin } from '../supabase.js'

// Account creation for the landing page and the platform's sign-up form.
//
// Creates the account directly (already confirmed) and returns a one-time login link
// for the platform's /auth/confirm page, so people are logged in straight away and no
// email is sent. Supabase's built-in email service only sends a few emails an hour,
// which made sign-ups fail with "too many attempts".
// Trade-off: email addresses aren't verified. Turn verification back on once custom
// SMTP is set up (README, "Account emails").
const router = Router()

const ROLES = ['student', 'mentor', 'company']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (value) => (typeof value === 'string' ? value.trim() : '')
const optional = (value, max) => text(value).slice(0, max) || null

export function validateSignup(body) {
  const role = text(body?.role)
  const firstName = text(body?.first_name)
  const lastName = text(body?.last_name)
  const email = text(body?.email).toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : ''
  const company = text(body?.company)

  if (!ROLES.includes(role)) return { error: 'Choose student, mentor or company.' }
  if (!firstName) return { error: 'Please enter your first name.' }
  if (!lastName) return { error: 'Please enter your surname.' }
  if (firstName.length > 60 || lastName.length > 60) return { error: 'Names must be 60 characters or fewer.' }
  if (!EMAIL.test(email) || email.length > 254) return { error: 'Please enter a valid email address.' }
  if (password.length < 8) return { error: 'Your password needs at least 8 characters.' }
  if (password.length > 72) return { error: 'Your password can be at most 72 characters.' }
  if (role === 'company' && !company) return { error: 'Please enter your company name.' }
  if (company.length > 200) return { error: 'Company name must be 200 characters or fewer.' }

  return {
    value: {
      role,
      email,
      password,
      company: role === 'company' ? company : null,
      metadata: {
        role,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        // Where the person came from, like the waiting list stored it (docs/utm.md).
        signup_source: {
          utm_source: optional(body?.utm_source, 100),
          utm_medium: optional(body?.utm_medium, 100),
          utm_campaign: optional(body?.utm_campaign, 100),
          referrer: optional(body?.referrer, 200),
          landing_path: optional(body?.landing_path, 200),
        },
      },
    },
  }
}

// A small per-address limit against scripted sign-ups. It lives in memory, so on Vercel
// each server instance counts on its own; it slows abuse down, it doesn't stop it.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 10
const attempts = new Map()
export function allowAttempt(key, now = Date.now()) {
  const recent = (attempts.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    attempts.set(key, recent)
    return false
  }
  recent.push(now)
  attempts.set(key, recent)
  return true
}

router.post('/', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Sign-up is not available right now.' })
  // Honeypot: people never see this field, bots fill it in. Pretend it worked.
  if (text(req.body?.website)) return res.status(201).json({ next: null })
  // Vercel puts the visitor's address in x-real-ip; req.ip would be Vercel's own proxy,
  // which would make every visitor share one limit.
  const visitor = String(req.headers['x-real-ip'] ?? req.ip ?? 'unknown')
  if (!allowAttempt(visitor)) {
    return res.status(429).json({ error: 'Too many sign-ups from this connection. Wait ten minutes and try again.' })
  }

  const { value, error } = validateSignup(req.body)
  if (error) return res.status(400).json({ error })

  const created = await supabaseAdmin.auth.admin.createUser({
    email: value.email,
    password: value.password,
    email_confirm: true,
    user_metadata: value.metadata,
  })
  if (created.error) {
    if (/already (been )?registered|already exists/i.test(created.error.message)) {
      return res.status(409).json({ error: 'There is already an account with this email. Log in instead.', duplicate: true })
    }
    return res.status(400).json({ error: 'We could not create your account. Check your details and try again.' })
  }

  // Companies give their name here, so their profile starts with it.
  if (value.company) {
    await supabaseAdmin.from('company_profiles').upsert({ id: created.data.user.id, organisation_name: value.company })
  }

  // One-time login for the new account. generateLink doesn't send an email.
  const link = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: value.email })
  const tokenHash = link.data?.properties?.hashed_token
  if (link.error || !tokenHash) {
    // The account exists; they can still log in with their password.
    return res.status(201).json({ next: '/login' })
  }
  res.status(201).json({ next: `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email` })
})

export default router

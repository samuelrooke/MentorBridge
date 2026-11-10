import { Router } from 'express'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

const ROLES = ['company', 'student', 'mentor']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Waiting list options. The same lists are in the form (landing/partials/signup.html) and the database (migration 0006).
export const SECTORS = [
  'ict', 'engineering', 'construction', 'logistics', 'healthcare', 'business', 'finance',
  'law', 'education', 'government', 'media', 'hospitality', 'other',
]
const AVAILABILITY = ['weekdays', 'evenings', 'weekends']
const AGE_RANGES = ['under-55', '55-59', '60-64', '65-69', '70+']
const HOURS_PER_MONTH = ['1-2', '3-5', '6-10', '10+']
const SKILLS_HELP = ['soft', 'hard', 'both']
const COMPANY_SIZES = ['1-49', '50-249', '250-999', '1000+']
const INTERESTS = ['internal', 'white_label', 'both']
const HOST_PATTERN = /^[a-z0-9.-]+$/i

const HAS_PLACEMENT = ['yes', 'no']
const APPLICATIONS_SENT = ['0', '1-10', '11-30', '30+']
const HELP_WANTED = ['cv', 'interviews', 'insight', 'introductions']
const NEEDED_BY = ['0-3', '3-6', 'later']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const text = (value) => (typeof value === 'string' ? value.trim() : '')

// Where the visitor came from: UTM tags, the referring site (host name only) and the first page they saw.
// Optional and never a reason to reject a sign-up: anything that doesn't fit is dropped.
export function cleanTracking(body) {
  const tracking = {}
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = text(body?.[key]).toLowerCase().slice(0, 100)
    if (value) tracking[key] = value
  }
  const referrer = text(body?.referrer).toLowerCase()
  if (referrer && referrer.length <= 200 && HOST_PATTERN.test(referrer)) tracking.referrer = referrer
  const path = text(body?.landing_path)
  if (path.startsWith('/') && path.length <= 200) tracking.landing_path = path
  return tracking
}

// Returns the cleaned fields, or { error } with a reason the form can show.
export function validatePilotRequest(body) {
  const variant = ['a', 'b'].includes(body?.variant) ? body.variant : undefined
  const role = body?.role
  const email = text(body?.email).toLowerCase()
  const name = text(body?.name)
  const fields = { role, email, name }

  if (!ROLES.includes(role)) return { error: 'Please choose student, mentor or organization.' }
  if (!name) return { error: role === 'company' ? 'Please enter your contact name.' : 'Please enter your name.' }
  if (name.length > 100) return { error: 'Name must be 100 characters or fewer.' }
  if (!email) return { error: 'Please enter your email.' }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: 'Please enter a valid email address.' }

  // Optional for mentors, required for students and companies.
  const sector = body?.sector || undefined
  if (sector !== undefined && !SECTORS.includes(sector)) return { error: 'Please choose a sector from the list.' }
  if (!sector && role !== 'mentor') return { error: 'Please choose a sector.' }
  if (sector) fields.sector = sector

  if (role === 'company') {
    const company = text(body?.company)
    const jobTitle = text(body?.job_title)
    if (!company) return { error: 'Please enter your organization name.' }
    if (company.length > 200) return { error: 'Organization name must be 200 characters or fewer.' }
    if (!jobTitle) return { error: 'Please enter your role.' }
    if (jobTitle.length > 100) return { error: 'Role must be 100 characters or fewer.' }
    Object.assign(fields, { company, job_title: jobTitle })
    if (body?.company_size) {
      if (!COMPANY_SIZES.includes(body.company_size)) return { error: 'Please choose a company size from the list.' }
      fields.company_size = body.company_size
    }
    if (body?.interest) {
      if (!INTERESTS.includes(body.interest)) return { error: 'Please choose how you would like to use MentorBridge.' }
      fields.interest = body.interest
    }
  } else {
    const list = [].concat(body?.availability ?? [])
    if (!list.length) return { error: 'Please choose when you are available.' }
    if (!list.every((item) => AVAILABILITY.includes(item))) return { error: 'Please choose from the listed times.' }
    fields.availability = AVAILABILITY.filter((item) => list.includes(item))

    if (role === 'mentor') {
      if (!AGE_RANGES.includes(body?.age_range)) return { error: 'Please choose your age range.' }
      if (!HOURS_PER_MONTH.includes(body?.hours_per_month)) return { error: 'Please choose how many hours a month you have.' }
      Object.assign(fields, { age_range: body.age_range, hours_per_month: body.hours_per_month })
    } else {
      if (!SKILLS_HELP.includes(body?.skills_help)) return { error: 'Please choose what you want help with.' }
      fields.skills_help = body.skills_help
    }
  }

  if (body?.consent !== true) return { error: 'Please agree to the privacy statement.' }

  return { ...fields, ...(variant ? { variant } : {}), ...cleanTracking(body) }
}

// Validates the optional follow-up answers. Every question may be skipped,
// but an answer that is given must be one of the options.
export function validateAnswers(body) {
  const answers = {}
  const pick = (key, options, error) => {
    const value = body?.[key]
    if (value === undefined || value === null || value === '') return null
    if (!options.includes(value)) return error
    answers[key] = value
    return null
  }

  const error =
    pick('has_placement', HAS_PLACEMENT, 'Please choose yes or no.') ||
    pick('applications_sent', APPLICATIONS_SENT, 'Please choose how many applications you sent.') ||
    pick('needed_by', NEEDED_BY, 'Please choose when you need your internship.')
  if (error) return { error }

  const help = body?.help_wanted
  if (help !== undefined && help !== null) {
    const list = Array.isArray(help) ? help : [help]
    if (list.length > HELP_WANTED.length || !list.every((item) => HELP_WANTED.includes(item))) {
      return { error: 'Please choose from the listed kinds of help.' }
    }
    if (list.length) answers.help_wanted = [...new Set(list)]
  }

  return answers
}

router.post('/', async (req, res) => {
  // Honeypot: real visitors never see the "website" field, so only bots fill it in.
  // Pretend it worked so they don't retry, but store nothing.
  if (req.body?.website) return res.status(201).json({ ok: true })

  const result = validatePilotRequest(req.body)
  if (result.error) return res.status(400).json({ error: result.error })

  if (!supabaseAdmin) return res.status(503).json({ error: 'The server is not configured to store requests.' })

  // Only these fields are stored: no IP address. The source (UTM tags, referring site) is
  // described on the privacy page.
  const { data, error } = await supabaseAdmin
    .from('pilot_requests')
    .insert({ ...result, consent_at: new Date().toISOString() })
    .select('id')
    .single()
  // Unique index on (role, email): this email is already on the list for this segment.
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'This email is already on the waiting list.', duplicate: true })
  }
  if (error) {
    console.error('Could not store pilot request:', error.message)
    return res.status(500).json({ error: 'Could not save your details. Please try again.' })
  }
  res.status(201).json({ ok: true, id: data.id })
})

// Saves the optional follow-up answers for a student who has just signed up.
// Only works once, within an hour of signing up, so an id can't be reused later.
router.patch('/:id/answers', async (req, res) => {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'Sign-up not found.' })

  const answers = validateAnswers(req.body)
  if (answers.error) return res.status(400).json({ error: answers.error })

  if (!supabaseAdmin) return res.status(503).json({ error: 'The server is not configured to store requests.' })

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('pilot_requests')
    .update({ ...answers, answered_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('role', 'student')
    .is('answered_at', null)
    .gte('created_at', oneHourAgo)
    .select('id')

  if (error) {
    console.error('Could not store answers:', error.message)
    return res.status(500).json({ error: 'Could not save your answers. Please try again.' })
  }
  if (!data.length) return res.status(404).json({ error: 'Sign-up not found.' })
  res.json({ ok: true })
})

export default router

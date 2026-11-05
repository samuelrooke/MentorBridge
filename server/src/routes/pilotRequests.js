import { Router } from 'express'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

const ROLES = ['company', 'student', 'mentor']
const INTERNS_PER_YEAR = ['1-2', '3-5', '6-10', '10+']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const HAS_PLACEMENT = ['yes', 'no']
const APPLICATIONS_SENT = ['0', '1-10', '11-30', '30+']
const HELP_WANTED = ['cv', 'interviews', 'insight', 'introductions']
const NEEDED_BY = ['0-3', '3-6', 'later']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const text = (value) => (typeof value === 'string' ? value.trim() : '')

// Returns the cleaned fields, or { error } with a reason the form can show.
export function validatePilotRequest(body) {
  const variant = ['a', 'b'].includes(body?.variant) ? body.variant : undefined
  const withVariant = (fields) => (variant ? { ...fields, variant } : fields)
  const role = body?.role ?? 'company'
  const email = text(body?.email).toLowerCase()

  if (!ROLES.includes(role)) return { error: 'Please choose student, mentor or organization.' }
  if (!email) return { error: 'Please enter your email.' }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: 'Please enter a valid email address.' }

  if (role === 'company') {
    const company = text(body?.company)
    if (!company) return { error: 'Please enter your organization name.' }
    if (company.length > 200) return { error: 'Organization name must be 200 characters or fewer.' }
    if (!INTERNS_PER_YEAR.includes(body?.interns_per_year)) {
      return { error: 'Please choose how many interns you take per year.' }
    }
    return withVariant({ role, email, company, interns_per_year: body.interns_per_year })
  }

  const field = text(body?.field)
  if (!field) return { error: role === 'student' ? 'Please enter your field of study.' : 'Please enter your field of work.' }
  if (field.length > 200) return { error: 'Field must be 200 characters or fewer.' }
  return withVariant({ role, email, field })
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

  // Only these fields are stored: no IP address or other tracking data.
  const { data, error } = await supabaseAdmin.from('pilot_requests').insert(result).select('id').single()
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

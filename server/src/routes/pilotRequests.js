import { Router } from 'express'
import { supabaseAdmin } from '../supabase.js'

const router = Router()

const INTERNS_PER_YEAR = ['1-2', '3-5', '6-10', '10+']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Returns the cleaned fields, or { error } with a reason the form can show.
export function validatePilotRequest(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const company = typeof body?.company === 'string' ? body.company.trim() : ''
  const internsPerYear = body?.interns_per_year

  if (!email) return { error: 'Please enter your work email.' }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: 'Please enter a valid email address.' }
  if (!company) return { error: 'Please enter your company name.' }
  if (company.length > 200) return { error: 'Company name must be 200 characters or fewer.' }
  if (!INTERNS_PER_YEAR.includes(internsPerYear)) return { error: 'Please choose how many interns you take per year.' }

  return { email, company, interns_per_year: internsPerYear }
}

router.post('/', async (req, res) => {
  // Honeypot: real visitors never see the "website" field, so only bots fill it in.
  // Pretend it worked so they don't retry, but store nothing.
  if (req.body?.website) return res.status(201).json({ ok: true })

  const result = validatePilotRequest(req.body)
  if (result.error) return res.status(400).json({ error: result.error })

  if (!supabaseAdmin) return res.status(503).json({ error: 'The server is not configured to store requests.' })

  // Only these fields are stored: no IP address or other tracking data.
  const { error } = await supabaseAdmin.from('pilot_requests').insert(result)
  if (error) {
    console.error('Could not store pilot request:', error.message)
    return res.status(500).json({ error: 'Could not save your request. Please try again.' })
  }
  res.status(201).json({ ok: true })
})

export default router

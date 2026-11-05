import { Router } from 'express'
import { supabaseAdmin } from '../supabase.js'

const router = Router()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (value) => (typeof value === 'string' ? value.trim() : '')

// Returns the cleaned fields, or { error } with a reason the form can show.
export function validateContact(body) {
  const name = text(body?.name)
  const email = text(body?.email).toLowerCase()
  const message = text(body?.message)

  if (!name) return { error: 'Please enter your name.' }
  if (name.length > 100) return { error: 'Name must be 100 characters or fewer.' }
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return { error: 'Please enter a valid email address.' }
  if (!message) return { error: 'Please write a message.' }
  if (message.length > 2000) return { error: 'Message must be 2000 characters or fewer.' }
  return { name, email, message }
}

router.post('/', async (req, res) => {
  // Honeypot: only bots fill in the hidden "website" field.
  if (req.body?.website) return res.status(201).json({ ok: true })

  const result = validateContact(req.body)
  if (result.error) return res.status(400).json({ error: result.error })

  if (!supabaseAdmin) return res.status(503).json({ error: 'The server is not configured to store messages.' })

  const { error } = await supabaseAdmin.from('contact_messages').insert(result)
  if (error) {
    console.error('Could not store contact message:', error.message)
    return res.status(500).json({ error: 'Could not send your message. Please try again.' })
  }
  res.status(201).json({ ok: true })
})

export default router

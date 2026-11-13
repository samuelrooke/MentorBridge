import { Router } from 'express'
import { canUnsend, deleteMessage } from '../messages.js'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

const router = Router()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Delete your own message for both people, within an hour of sending it.
router.post('/:id/unsend', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Deleting messages is not available right now.' })
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown message.' })
  const { data: message } = await supabaseAdmin.from('messages')
    .select('id, sender_id, created_at, deleted_at, attachment_path').eq('id', req.params.id).maybeSingle()
  if (!message || message.sender_id !== req.user.id) return res.status(404).json({ error: 'Message not found.' })
  if (message.deleted_at) return res.json({ ok: true })
  if (!canUnsend(message, req.user.id)) {
    return res.status(403).json({ error: 'You can only delete a message within an hour of sending it. Ask the MentorBridge team if it needs to go.' })
  }
  try {
    await deleteMessage(supabaseAdmin, message, req.user.id)
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Could not delete the message. Try again.' })
  }
})

// Edit the text of your own message, within the same hour. Shown as "edited".
router.post('/:id/edit', requireAuth, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Editing messages is not available right now.' })
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown message.' })
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (body.length > 5000) return res.status(400).json({ error: 'A message can be at most 5,000 characters.' })
  const { data: message } = await supabaseAdmin.from('messages')
    .select('id, sender_id, created_at, deleted_at, attachment_path').eq('id', req.params.id).maybeSingle()
  if (!message || message.sender_id !== req.user.id) return res.status(404).json({ error: 'Message not found.' })
  if (!canUnsend(message, req.user.id)) {
    return res.status(403).json({ error: 'You can only edit a message within an hour of sending it.' })
  }
  if (!body && !message.attachment_path) return res.status(400).json({ error: 'A message can’t be empty. Delete it instead.' })
  const { error } = await supabaseAdmin.from('messages').update({ body, edited_at: new Date().toISOString() }).eq('id', message.id)
  if (error) return res.status(500).json({ error: 'Could not save your change. Try again.' })
  res.json({ ok: true })
})

export default router

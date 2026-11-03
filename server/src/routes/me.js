import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email }, profile: req.profile })
})

// Matches the signed-in user can see, filtered by row level security.
router.get('/matches', requireAuth, async (req, res) => {
  const { data, error } = await req.supabase
    .from('matches')
    .select('*, student:student_id(full_name), mentor:mentor_id(full_name), company:company_id(full_name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router

import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

const router = Router()
router.use((_req, res, next) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin routes need SUPABASE_SERVICE_ROLE_KEY on the server' })
  next()
})
router.use(requireAuth, requireRole('admin'))

// Everyone available for manual matching, with their intake answers.
router.get('/candidates', async (_req, res) => {
  const [students, mentors, companies] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, email, student_profiles(*)').eq('role', 'student'),
    supabaseAdmin.from('profiles').select('id, full_name, email, mentor_profiles(*)').eq('role', 'mentor'),
    supabaseAdmin.from('profiles').select('id, full_name, email, company_profiles(*)').eq('role', 'company'),
  ])
  const error = students.error || mentors.error || companies.error
  if (error) return res.status(500).json({ error: error.message })
  res.json({ students: students.data, mentors: mentors.data, companies: companies.data })
})

router.post('/matches', async (req, res) => {
  const { student_id, mentor_id, company_id = null } = req.body ?? {}
  if (!student_id || !mentor_id) {
    return res.status(400).json({ error: 'student_id and mentor_id are required' })
  }
  const { data, error } = await supabaseAdmin
    .from('matches')
    .insert({ student_id, mentor_id, company_id, created_by: req.user.id })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/matches/:id', async (req, res) => {
  const { status } = req.body ?? {}
  const { data, error } = await supabaseAdmin
    .from('matches')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

export default router

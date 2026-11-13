import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'
import { findKeywordMatches } from '../matching.js'

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

router.post('/auto-match', requireAuth, async (req, res) => {
  if (!['student', 'mentor'].includes(req.profile?.role)) {
    return res.status(403).json({ error: 'Only students and mentors can request keyword matching.' })
  }
  if (!supabaseAdmin) return res.status(503).json({ error: 'Automatic matching needs the server service-role key.' })

  const studentQuery = supabaseAdmin.from('student_profiles')
    .select('id, field_of_study, internship_type, interests, learning_goals')
  const mentorQuery = supabaseAdmin.from('mentor_profiles').select('id, expertise')
  const [studentsResult, mentorsResult, existingResult, rolesResult] = await Promise.all([
    req.profile.role === 'student' ? studentQuery.eq('id', req.user.id) : studentQuery,
    req.profile.role === 'mentor' ? mentorQuery.eq('id', req.user.id) : mentorQuery,
    supabaseAdmin.from('matches').select('student_id, mentor_id'),
    supabaseAdmin.from('profiles').select('id, role').in('role', ['student', 'mentor']),
  ])

  const queryError = studentsResult.error || mentorsResult.error || existingResult.error || rolesResult.error
  if (queryError) return res.status(500).json({ error: 'Could not check matching keywords.' })

  // Only people whose account still has that role: answers can stay behind when a role changes.
  const roleOf = new Map((rolesResult.data ?? []).map(({ id, role }) => [id, role]))
  const students = (studentsResult.data ?? []).filter(({ id }) => roleOf.get(id) === 'student')
  const mentors = (mentorsResult.data ?? []).filter(({ id }) => roleOf.get(id) === 'mentor')

  const existingPairs = new Set((existingResult.data ?? []).map(({ student_id, mentor_id }) => `${student_id}:${mentor_id}`))
  const candidates = findKeywordMatches(students, mentors)
    .filter(({ student_id, mentor_id }) => !existingPairs.has(`${student_id}:${mentor_id}`))
  if (!candidates.length) return res.json({ created: 0 })

  const rows = candidates.map(({ student_id, mentor_id }) => ({
    student_id,
    mentor_id,
    status: 'active',
    created_by: req.user.id,
  }))
  const { data, error } = await supabaseAdmin.from('matches').insert(rows).select('id')
  if (error) return res.status(500).json({ error: 'Could not create keyword matches.' })
  res.status(201).json({ created: data.length })
})

export default router

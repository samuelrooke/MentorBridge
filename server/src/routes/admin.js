import { Router } from 'express'
import { ROLES, allUsers, confirmEmail, deleteAccount, setRole } from '../accounts.js'
import { matchesWithActivity, recentActivity, summarizeOverview } from '../adminStats.js'
import { findKeywordMatches } from '../matching.js'
import { deleteMessage } from '../messages.js'
import { companyOverview } from './company.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

// Everything the admin dashboard needs that the browser can't do with row level security:
// accounts (logins live in Supabase Auth), the waiting list and contact messages (no public
// access at all), and overviews across every table. All routes need an admin login.
const router = Router()
router.use((_req, res, next) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Admin routes need SUPABASE_SERVICE_ROLE_KEY on the server' })
  next()
})
router.use(requireAuth, requireRole('admin'))

const MATCH_STATUSES = ['proposed', 'active', 'completed', 'cancelled']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Express 5 forwards rejected promises to the error handler; this adds a readable message.
const fail = (res, error, status = 500) => res.status(status).json({ error: error?.message ?? String(error) })

async function rows(table, columns = '*') {
  const { data, error } = await supabaseAdmin.from(table).select(columns)
  if (error) throw error
  return data ?? []
}

async function loadAll() {
  const [users, profiles, matches, sessions, messages, waitlist, contact, reports, reviews] = await Promise.all([
    allUsers(supabaseAdmin),
    rows('profiles', 'id, role, full_name, email, created_at'),
    rows('matches', 'id, student_id, mentor_id, company_id, status, created_at'),
    rows('sessions', 'id, match_id, starts_at'),
    rows('messages', 'id, match_id, created_at'),
    rows('pilot_requests'),
    rows('contact_messages'),
    rows('reports', 'id, status'),
    rows('session_reviews', 'rating, took_place'),
  ])
  return { users, profiles, matches, sessions, messages, waitlist, contact, reports, reviews }
}

// ---- Overview ----

router.get('/overview', async (_req, res) => {
  try {
    const data = await loadAll()
    res.json({
      ...summarizeOverview(data),
      recent: recentActivity(data, 12),
      upcomingMatches: matchesWithActivity(data).filter((m) => m.next_session_at).slice(0, 5),
    })
  } catch (error) {
    fail(res, error)
  }
})

// ---- Accounts ----

router.get('/users', async (_req, res) => {
  try {
    const [users, profiles, students, mentors, companies, matches] = await Promise.all([
      allUsers(supabaseAdmin),
      rows('profiles'),
      rows('student_profiles'),
      rows('mentor_profiles'),
      rows('company_profiles'),
      rows('matches', 'id, student_id, mentor_id, company_id, status'),
    ])
    const profileOf = new Map(profiles.map((p) => [p.id, p]))
    const answersOf = new Map([...students, ...mentors, ...companies].map((a) => [a.id, a]))
    res.json(users.map((u) => {
      const profile = profileOf.get(u.id)
      return {
        id: u.id,
        email: u.email,
        confirmed: Boolean(u.email_confirmed_at),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        role: profile?.role ?? null,
        full_name: profile?.full_name ?? null,
        bio: profile?.bio ?? null,
        answers: answersOf.get(u.id) ?? null,
        match_count: matches.filter((m) => [m.student_id, m.mentor_id, m.company_id].includes(u.id)).length,
      }
    }).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')))
  } catch (error) {
    fail(res, error)
  }
})

router.patch('/users/:id', async (req, res) => {
  const { id } = req.params
  const { role, confirm } = req.body ?? {}
  if (!UUID.test(id)) return res.status(400).json({ error: 'Unknown account.' })
  if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role.' })
  // Keeps at least the current admin in: you can't lock yourself out.
  if (role !== undefined && id === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'You can’t remove your own admin role. Ask another admin.' })
  }
  try {
    if (role !== undefined) await setRole(supabaseAdmin, id, role)
    if (confirm === true) await confirmEmail(supabaseAdmin, id)
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 400)
  }
})

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params
  if (!UUID.test(id)) return res.status(400).json({ error: 'Unknown account.' })
  if (id === req.user.id) return res.status(400).json({ error: 'You can’t delete your own account here.' })
  try {
    await deleteAccount(supabaseAdmin, id)
    res.json({ ok: true })
  } catch (error) {
    fail(res, error, 400)
  }
})

// ---- Matches ----

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

router.get('/matches', async (_req, res) => {
  try {
    const data = await loadAll()
    res.json(matchesWithActivity(data))
  } catch (error) {
    fail(res, error)
  }
})

// Student and mentor pairs that share keywords and aren't matched yet.
router.get('/suggestions', async (_req, res) => {
  try {
    const [profiles, students, mentors, matches] = await Promise.all([
      rows('profiles', 'id, role, full_name, email'),
      rows('student_profiles', 'id, field_of_study, internship_type, interests, learning_goals'),
      rows('mentor_profiles', 'id, expertise'),
      rows('matches', 'student_id, mentor_id, status'),
    ])
    const profileOf = new Map(profiles.map((p) => [p.id, p]))
    const taken = new Set(matches.filter((m) => m.status !== 'cancelled').map((m) => `${m.student_id}:${m.mentor_id}`))
    const suggestions = findKeywordMatches(
      students.filter((s) => profileOf.get(s.id)?.role === 'student'),
      mentors.filter((m) => profileOf.get(m.id)?.role === 'mentor'),
    )
      .filter((s) => !taken.has(`${s.student_id}:${s.mentor_id}`))
      .map((s) => ({
        ...s,
        student_name: profileOf.get(s.student_id)?.full_name || profileOf.get(s.student_id)?.email,
        mentor_name: profileOf.get(s.mentor_id)?.full_name || profileOf.get(s.mentor_id)?.email,
      }))
      .sort((a, b) => b.keywords.length - a.keywords.length)
    res.json(suggestions)
  } catch (error) {
    fail(res, error)
  }
})

router.post('/matches', async (req, res) => {
  const { student_id, mentor_id, company_id = null, status = 'active' } = req.body ?? {}
  if (!UUID.test(student_id ?? '') || !UUID.test(mentor_id ?? '')) {
    return res.status(400).json({ error: 'Choose a student and a mentor.' })
  }
  if (company_id !== null && !UUID.test(company_id)) return res.status(400).json({ error: 'Unknown company.' })
  if (!MATCH_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' })
  const { data, error } = await supabaseAdmin
    .from('matches')
    .insert({ student_id, mentor_id, company_id, status, created_by: req.user.id })
    .select()
    .single()
  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json(data)
})

router.patch('/matches/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown match.' })
  const { status, company_id } = req.body ?? {}
  const update = {}
  if (status !== undefined) {
    if (!MATCH_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' })
    update.status = status
  }
  if (company_id !== undefined) {
    if (company_id !== null && !UUID.test(company_id)) return res.status(400).json({ error: 'Unknown company.' })
    update.company_id = company_id
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to change.' })
  const { data, error } = await supabaseAdmin.from('matches').update(update).eq('id', req.params.id).select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data)
})

// Deleting a match also deletes its sessions, messages, plan and feedback (cascade).
router.delete('/matches/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown match.' })
  const { error } = await supabaseAdmin.from('matches').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

// The company view, for "View as" a company.
router.get('/company/:id/overview', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown company.' })
  try {
    res.json(await companyOverview(req.params.id))
  } catch (error) {
    fail(res, error)
  }
})

// ---- Messages and reports ----

// Removes any message for both people (text and picture). Shown as "Deleted by the MentorBridge team".
router.delete('/messages/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown message.' })
  const { data: message } = await supabaseAdmin.from('messages')
    .select('id, attachment_path, deleted_at').eq('id', req.params.id).maybeSingle()
  if (!message) return res.status(404).json({ error: 'Message not found.' })
  if (message.deleted_at) return res.json({ ok: true })
  try {
    await deleteMessage(supabaseAdmin, message, req.user.id)
    res.json({ ok: true })
  } catch (error) {
    fail(res, error)
  }
})

router.get('/reports', async (_req, res) => {
  try {
    const [reports, profiles, matches] = await Promise.all([
      rows('reports'),
      rows('profiles', 'id, full_name, email, role'),
      rows('matches', 'id, student_id, mentor_id'),
    ])
    const person = new Map(profiles.map((p) => [p.id, p]))
    const nameOf = (id) => (id ? person.get(id)?.full_name || person.get(id)?.email || 'Deleted account' : null)
    const matchOf = new Map(matches.map((m) => [m.id, m]))
    res.json(reports
      .sort((a, b) => (a.status === b.status ? b.created_at.localeCompare(a.created_at) : a.status === 'open' ? -1 : 1))
      .map((r) => ({
        ...r,
        reporter_name: nameOf(r.reporter_id),
        reporter_role: person.get(r.reporter_id)?.role ?? null,
        reported_name: nameOf(r.reported_user_id),
        reported_role: person.get(r.reported_user_id)?.role ?? null,
        match_label: matchOf.has(r.match_id)
          ? `${nameOf(matchOf.get(r.match_id).student_id)} with ${nameOf(matchOf.get(r.match_id).mentor_id)}`
          : null,
      })))
  } catch (error) {
    fail(res, error)
  }
})

router.patch('/reports/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown report.' })
  const { status, admin_note } = req.body ?? {}
  const update = {}
  if (status !== undefined) {
    if (!['open', 'resolved'].includes(status)) return res.status(400).json({ error: 'Unknown status.' })
    update.status = status
    update.resolved_by = status === 'resolved' ? req.user.id : null
    update.resolved_at = status === 'resolved' ? new Date().toISOString() : null
  }
  if (admin_note !== undefined) {
    if (admin_note !== null && (typeof admin_note !== 'string' || admin_note.length > 2000)) {
      return res.status(400).json({ error: 'Notes can be at most 2,000 characters.' })
    }
    update.admin_note = admin_note?.trim() || null
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to change.' })
  const { error } = await supabaseAdmin.from('reports').update(update).eq('id', req.params.id)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

// ---- Waiting list and contact form ----

router.get('/waitlist', async (_req, res) => {
  try {
    const data = await rows('pilot_requests')
    res.json(data.sort((a, b) => b.created_at.localeCompare(a.created_at)))
  } catch (error) {
    fail(res, error)
  }
})

router.delete('/waitlist/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown entry.' })
  const { error } = await supabaseAdmin.from('pilot_requests').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

router.get('/contact', async (_req, res) => {
  try {
    const data = await rows('contact_messages')
    res.json(data.sort((a, b) => b.created_at.localeCompare(a.created_at)))
  } catch (error) {
    fail(res, error)
  }
})

router.delete('/contact/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Unknown entry.' })
  const { error } = await supabaseAdmin.from('contact_messages').delete().eq('id', req.params.id)
  if (error) return res.status(400).json({ error: error.message })
  res.json({ ok: true })
})

export default router

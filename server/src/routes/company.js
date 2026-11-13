import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { supabaseAdmin } from '../supabase.js'

// The company's view of its interns. A company only sees a match after the student has
// shared it (consents table, not revoked). Sessions stay private to the student and mentor:
// the company gets counts, not dates, notes or links. Messages are never included.
const router = Router()
router.use(requireAuth, requireRole('company'))

export function summarizeCompanyMatches({ matches = [], consents = [], profiles = [], sessions = [], activities = [] }, now = Date.now()) {
  const shared = new Set(consents.filter((c) => !c.revoked_at).map((c) => c.match_id))
  const nameOf = new Map(profiles.map((p) => [p.id, p.full_name || 'Unknown']))
  const visible = matches.filter((m) => shared.has(m.id))
  return {
    waitingForConsent: matches.length - visible.length,
    interns: visible
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((m) => {
        const own = sessions.filter((s) => s.match_id === m.id)
        const steps = activities.filter((a) => a.match_id === m.id)
        return {
          match_id: m.id,
          status: m.status,
          matched_at: m.created_at,
          student_name: nameOf.get(m.student_id) ?? 'Unknown',
          mentor_name: nameOf.get(m.mentor_id) ?? 'Unknown',
          sessions_held: own.filter((s) => new Date(s.starts_at).getTime() < now).length,
          sessions_planned: own.filter((s) => new Date(s.starts_at).getTime() >= now).length,
          plan_done: steps.filter((a) => a.completed_at).length,
          plan_total: steps.length,
        }
      }),
  }
}

// Also used by the admin route for "View as" a company (routes/admin.js).
export async function companyOverview(companyId) {
  const { data: matches, error } = await supabaseAdmin.from('matches')
    .select('id, student_id, mentor_id, status, created_at').eq('company_id', companyId)
  if (error) throw error
  const ids = (matches ?? []).map((m) => m.id)
  if (!ids.length) return { waitingForConsent: 0, interns: [] }
  const people = [...new Set(matches.flatMap((m) => [m.student_id, m.mentor_id]))]
  const [consents, profiles, sessions, activities] = await Promise.all([
    supabaseAdmin.from('consents').select('match_id, revoked_at').in('match_id', ids),
    supabaseAdmin.from('profiles').select('id, full_name').in('id', people),
    supabaseAdmin.from('sessions').select('match_id, starts_at').in('match_id', ids),
    supabaseAdmin.from('plan_activities').select('match_id, completed_at').in('match_id', ids),
  ])
  return summarizeCompanyMatches({
    matches,
    consents: consents.data ?? [],
    profiles: profiles.data ?? [],
    sessions: sessions.data ?? [],
    activities: activities.data ?? [],
  })
}

router.get('/overview', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Not available right now.' })
  try {
    res.json(await companyOverview(req.user.id))
  } catch {
    res.status(500).json({ error: 'Could not load your interns.' })
  }
})

export default router

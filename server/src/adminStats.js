// Numbers for the admin dashboard, computed from plain rows so they can be tested
// without a database. Nothing here is estimated: every number is a count of real rows.

const DAY = 24 * 60 * 60 * 1000
const SEGMENTS = ['student', 'mentor', 'company']

// Version 3 targets before a payment model (MentorBridge_context.md, section 8).
// Targets, not data: the dashboard labels them that way.
export const TARGETS = { student: 500, mentor: 1000, company: 50 }

const count = (rows, fn) => rows.reduce((total, row) => total + (fn(row) ? 1 : 0), 0)
const since = (value, now, days) => Boolean(value) && now - new Date(value).getTime() <= days * DAY

export function sourceOf(request) {
  if (request.utm_source) return request.utm_source
  if (request.referrer) return request.referrer
  return 'direct'
}

export function summarizeOverview({ users = [], profiles = [], matches = [], sessions = [], messages = [], waitlist = [], contact = [] }, now = Date.now()) {
  const roleOf = new Map(profiles.map((p) => [p.id, p.role]))
  const byRole = { student: 0, mentor: 0, company: 0, admin: 0 }
  for (const user of users) {
    const role = roleOf.get(user.id)
    if (role in byRole) byRole[role]++
  }

  const openStatuses = new Set(['proposed', 'active'])
  const matched = new Set(matches.filter((m) => openStatuses.has(m.status)).flatMap((m) => [m.student_id, m.mentor_id]))
  const unmatched = (role) => profiles.filter((p) => p.role === role && !matched.has(p.id)).length

  // Sign-ups are accounts (since 13 November the landing form creates an account) plus
  // waiting list entries from before that. Someone in both is counted once.
  const accountEmails = new Set(users.map((u) => u.email?.toLowerCase()).filter(Boolean))
  const waitlistOnly = waitlist.filter((r) => !accountEmails.has(r.email?.toLowerCase()))
  const sources = new Map()
  const addSource = (source) => sources.set(source, (sources.get(source) ?? 0) + 1)
  for (const request of waitlistOnly) addSource(sourceOf(request))
  for (const user of users) {
    const role = roleOf.get(user.id)
    if (user.user_metadata?.signup_source && role !== 'admin') addSource(sourceOf(user.user_metadata.signup_source))
  }

  const waitlistByRole = Object.fromEntries(SEGMENTS.map((role) => [role, count(waitlist, (r) => r.role === role)]))
  const signupsByRole = Object.fromEntries(SEGMENTS.map((role) => [role, byRole[role] + count(waitlistOnly, (r) => r.role === role)]))

  return {
    accounts: {
      total: users.length,
      byRole,
      unconfirmed: count(users, (u) => !u.email_confirmed_at),
      newLast7Days: count(users, (u) => since(u.created_at, now, 7)),
    },
    matches: {
      total: matches.length,
      byStatus: Object.fromEntries(['proposed', 'active', 'completed', 'cancelled'].map((s) => [s, count(matches, (m) => m.status === s)])),
      studentsWithoutMatch: unmatched('student'),
      mentorsWithoutMatch: unmatched('mentor'),
    },
    sessions: {
      total: sessions.length,
      upcoming: count(sessions, (s) => new Date(s.starts_at).getTime() >= now),
      next7Days: count(sessions, (s) => {
        const start = new Date(s.starts_at).getTime()
        return start >= now && start - now <= 7 * DAY
      }),
    },
    messages: {
      total: messages.length,
      last7Days: count(messages, (m) => since(m.created_at, now, 7)),
    },
    waitlist: {
      total: waitlist.length,
      byRole: waitlistByRole,
      last7Days: count(waitlist, (r) => since(r.created_at, now, 7)),
      bySource: [...sources].map(([source, total]) => ({ source, total })).sort((a, b) => b.total - a.total),
      targets: SEGMENTS.map((role) => ({ role, signups: signupsByRole[role], target: TARGETS[role] })),
    },
    contact: { total: contact.length },
  }
}

// One row per match with names and activity, newest match first.
export function matchesWithActivity({ matches = [], profiles = [], sessions = [], messages = [] }, now = Date.now()) {
  const nameOf = new Map(profiles.map((p) => [p.id, p.full_name || p.email || 'Unknown']))
  return [...matches]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((match) => {
      const own = sessions.filter((s) => s.match_id === match.id)
      const upcoming = own.filter((s) => new Date(s.starts_at).getTime() >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      const chat = messages.filter((m) => m.match_id === match.id)
      const lastMessageAt = chat.reduce((latest, m) => (!latest || m.created_at > latest ? m.created_at : latest), null)
      return {
        ...match,
        student_name: nameOf.get(match.student_id) ?? 'Unknown',
        mentor_name: nameOf.get(match.mentor_id) ?? 'Unknown',
        company_name: match.company_id ? nameOf.get(match.company_id) ?? 'Unknown' : null,
        session_count: own.length,
        next_session_at: upcoming[0]?.starts_at ?? null,
        message_count: chat.length,
        last_message_at: lastMessageAt,
      }
    })
}

// Latest things that happened, across accounts, waiting list and contact form.
export function recentActivity({ users = [], profiles = [], waitlist = [], contact = [] }, limit = 10) {
  const profileOf = new Map(profiles.map((p) => [p.id, p]))
  const events = [
    ...users.map((u) => ({ type: 'account', at: u.created_at, label: profileOf.get(u.id)?.full_name || u.email, detail: profileOf.get(u.id)?.role ?? 'no profile' })),
    ...waitlist.map((r) => ({ type: 'waitlist', at: r.created_at, label: r.name || r.email, detail: r.role })),
    ...contact.map((c) => ({ type: 'contact', at: c.created_at, label: c.name || c.email, detail: 'contact form' })),
  ]
  return events.filter((e) => e.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

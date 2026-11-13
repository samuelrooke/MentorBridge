import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useViewer } from '../context/viewer'
import { supabase } from '../lib/supabase'
import { useMatches } from '../lib/useMatches'
import { useSessions } from '../lib/useSessions'
import type { PlatformMessage, PlatformSession } from '../lib/platform'
// Loaded only for admins, so students and mentors don't download it.
const AdminDashboard = lazy(() => import('./AdminDashboard'))

const roleNames = { student: 'Student', company: 'Company', mentor: 'Mentor', admin: 'Admin' }
// The answer that matching needs most, per role. If it's empty, the dashboard asks to finish the profile.
const keyAnswer = {
  student: { table: 'student_profiles', column: 'learning_goals' },
  mentor: { table: 'mentor_profiles', column: 'expertise' },
  company: { table: 'company_profiles', column: 'organisation_name' },
} as const
type Activity = { id: string; match_id: string; title: string; completed_at: string | null; due_date: string | null; sort_order: number }
type MessagePreview = PlatformMessage & { match_id: string }

// Admins get the admin dashboard; everyone else (and an admin viewing as someone) the member dashboard.
export default function Dashboard() {
  const { viewer } = useViewer()
  if (viewer?.role === 'admin') return <Suspense fallback={<p className="muted">Loading the admin dashboard…</p>}><AdminDashboard /></Suspense>
  // A new key per person resets the page state when an admin switches who they view as.
  return <MemberDashboard key={viewer?.id ?? 'none'} />
}

function MemberDashboard() {
  const { session } = useAuth()
  // "profile" is whoever the page shows: the logged-in user, or the person an admin views as.
  const { viewer: profile, viewingAs } = useViewer()
  const { matches, loading: matchesLoading, error } = useMatches(profile?.role, profile?.id)
  const { sessions } = useSessions(matches)
  const { unreadCounts } = useOutletContext<{ unreadCounts: Record<string, number> }>()
  const [activities, setActivities] = useState<Activity[]>([])
  const [lastMessages, setLastMessages] = useState<Record<string, MessagePreview>>({})
  const [learningGoals, setLearningGoals] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [referenceTime] = useState(() => Date.now())
  const [profileDone, setProfileDone] = useState(true)
  // Greet by first name: saved on the account at sign-up, or the first word of the full name for older accounts.
  const ownFirstName = viewingAs ? undefined : (session?.user.user_metadata?.first_name as string | undefined)?.trim()
  const firstName = ownFirstName || profile?.full_name?.trim().split(/\s+/)[0]
  const member = profile?.role === 'student' || profile?.role === 'mentor'
  const matchIds = matches.map(({ id }) => id).join(',')

  useEffect(() => {
    let active = true
    async function loadDetails() {
      if (!member || !matchIds) {
        setActivities([])
        setLastMessages({})
        return
      }
      const ids = matchIds.split(',')
      const [activityResult, messageResult] = await Promise.all([
        supabase.from('plan_activities').select('id, match_id, title, completed_at, due_date, sort_order').in('match_id', ids).order('sort_order'),
        supabase.from('messages').select('id, match_id, sender_id, body, created_at').in('match_id', ids).order('created_at', { ascending: false }),
      ])
      if (!active) return
      setActivities((activityResult.data ?? []) as Activity[])
      const latest: Record<string, MessagePreview> = {}
      for (const message of messageResult.data ?? []) {
        if (!latest[message.match_id]) latest[message.match_id] = message as MessagePreview
      }
      setLastMessages(latest)
    }
    void loadDetails()
    return () => { active = false }
  }, [matchIds, member])

  useEffect(() => {
    if (profile?.role !== 'student') return
    let active = true
    void supabase.from('student_profiles').select('learning_goals').eq('id', profile.id).maybeSingle()
      .then(({ data }) => { if (active) setLearningGoals(data?.learning_goals ?? '') })
    return () => { active = false }
  }, [profile?.id, profile?.role])

  useEffect(() => {
    if (!profile || profile.role === 'admin') return
    const { table, column } = keyAnswer[profile.role]
    let active = true
    void supabase.from(table).select(column).eq('id', profile.id).maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active || loadError) return
        const answer = (data as Record<string, string | null> | null)?.[column]
        setProfileDone(Boolean(answer?.trim()))
      })
    return () => { active = false }
  }, [profile])

  useEffect(() => {
    if (!profile?.avatar_path) return
    let active = true
    void supabase.storage.from('avatars').createSignedUrl(profile.avatar_path, 60 * 60)
      .then(({ data }) => { if (active && data?.signedUrl) setAvatarUrl(data.signedUrl) })
    return () => { active = false }
  }, [profile?.avatar_path])

  const upcomingSessions = sessions.filter((item) => new Date(item.starts_at).getTime() >= referenceTime)
  const latestMessage = Object.values(lastMessages).sort((first, second) => second.created_at.localeCompare(first.created_at))[0]
  const latestMessageMatch = latestMessage ? matches.find((match) => match.id === latestMessage.match_id) : undefined
  const unreadTotal = Object.values(unreadCounts).reduce((total, count) => total + count, 0)
  const completedActivities = activities.filter((activity) => activity.completed_at).length
  const nextActivity = activities.find((activity) => !activity.completed_at)
  const peopleCount = profile?.role === 'student'
    ? new Set(matches.map((match) => match.mentor_id)).size
    : new Set(matches.map((match) => match.student_id)).size

  return (
    <div className="stack">
      <header className="dashboard-heading">
        <div className="dashboard-greeting">
          {avatarUrl ? <img className="dashboard-avatar" src={avatarUrl} alt="" /> : <span className="dashboard-avatar-fallback" aria-hidden="true">{profile?.full_name?.slice(0, 1).toUpperCase() ?? '?'}</span>}
          <div><p className="eyebrow">{profile && roleNames[profile.role]}</p><h1>{firstName ? `Hello, ${firstName}` : 'Your dashboard'}</h1><p className="muted">{profile?.bio || (viewingAs ? viewingAs.email : session?.user.email)}</p></div>
        </div>
      </header>
      {!profileDone && (
        <section className="card finish-profile" aria-labelledby="finish-profile-title">
          <div>
            <p className="eyebrow">Next step</p>
            <h2 id="finish-profile-title">{viewingAs ? 'Profile not finished' : 'Finish your profile'}</h2>
            <p className="muted">{viewingAs
              ? `${firstName ?? 'This person'} hasn’t answered the profile questions yet, so matching can’t use them.`
              : profile?.role === 'company'
                ? 'Tell us about your company so we can set things up. It takes about two minutes.'
                : 'Answer a few short questions so we can find you a match. It takes about two minutes.'}</p>
          </div>
          {!viewingAs && <Link className="btn btn-primary" to="/profile?welcome=1">Answer the questions</Link>}
        </section>
      )}
      {error && <p className="alert alert-error">Could not load your matches. {error}</p>}
      {!matchesLoading && member && <section className="dashboard-metrics" aria-label="Your overview">
        <article className="metric-item"><span>{profile?.role === 'student' ? 'Mentors' : 'Students'}</span><strong>{peopleCount}</strong></article>
        <article className="metric-item"><span>Lessons</span><strong>{sessions.length}</strong></article>
        <article className="metric-item"><span>Plan steps</span><strong>{completedActivities}/{activities.length}</strong></article>
      </section>}
      {profile?.role === 'admin' ? (
        <section className="card admin-home stack-sm"><h2>Matching</h2><p className="muted">Review requests and connect students with mentors.</p><Link className="btn btn-primary" to="/admin">Open matching</Link></section>
      ) : matchesLoading ? (
        <p className="muted">Loading your workspace...</p>
      ) : (profile?.role === 'student' || profile?.role === 'mentor') ? (
        <div className="dashboard-overview">
          <section className="card overview-section match-summary">
            <p className="eyebrow">Mentor matching</p>
            {matches.length ? <div className="overview-rows">{matches.map((match) => {
              const person = profile.role === 'student' ? match.mentor : match.student
              return <div className="overview-row" key={match.id}><div><strong>{person?.full_name ?? 'Your match'}</strong><span className="muted">{match.status}</span></div>{match.company?.full_name && <span className="muted">{match.company.full_name}</span>}</div>
            })}</div> : <p className="muted">No match yet. The team is working on it.</p>}
            <Link className="text-link" to="/matching">View matching status</Link>
          </section>

          <section className="card overview-section next-session">
            <div className="overview-title"><p className="eyebrow">Schedule</p><Link className="text-link" to="/schedule">Open calendar</Link></div>
            <h2>Upcoming events</h2>
            <MiniCalendar sessions={sessions} />
            {upcomingSessions.length ? <div className="overview-rows">{upcomingSessions.slice(0, 3).map((item) => {
              const match = matches.find(({ id }) => id === item.match_id)
              return <div className="overview-row" key={item.id}><div><strong>{item.title || 'MentorBridge session'}</strong><span className="muted">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.starts_at))}</span></div><span className="muted">{item.duration_min} min</span>{item.meeting_url && <a className="text-link" href={item.meeting_url} target="_blank" rel="noreferrer">Join</a>}{match?.id && <span className="sr-only">With {profile.role === 'student' ? match.mentor?.full_name : match.student?.full_name}</span>}</div>
            })}</div> : <p className="muted">{matches.length ? 'No upcoming events. Plan a session to add one.' : 'Upcoming events will appear here after you are matched.'}</p>}
          </section>

          <Link to="/messages" className="card overview-section message-summary">
            <div className="overview-title"><p className="eyebrow">Messages</p>{unreadTotal > 0 && <span className="unread-badge">{unreadTotal} unread</span>}</div>
            <h2>{latestMessageMatch?.[profile.role === 'student' ? 'mentor' : 'student']?.full_name ?? (matches.length ? 'Your conversations' : 'No people yet')}</h2>
            <p className="muted">{latestMessage?.body ?? (matches.length ? 'No messages yet. Start a conversation with your match.' : 'Your people list and private chat will appear here after you are matched.')}</p>
            <span className="text-link">Open messages</span>
          </Link>

          <section className="card overview-section plan-summary">
            <p className="eyebrow">Learning plan</p>
            {profile?.role === 'student' ? <>
              <h2>What you want to learn</h2>
              <p className="muted">{learningGoals || 'Add keywords for the skills and topics you want to learn.'}</p>
              <Link className="text-link" to="/profile">Edit learning goals</Link>
            </> : <p className="muted">Your students’ learning goals will appear here when you are matched.</p>}
            <div className="plan-progress-summary">
              <strong>{completedActivities} of {activities.length} plan steps done</strong>
              <span className="muted">{nextActivity ? `Next: ${nextActivity.title}` : activities.length ? 'All steps are complete.' : 'Shared plan steps will appear here.'}</span>
            </div>
          </section>
        </div>
      ) : profile?.role === 'company' ? (
        <section className="workspace-grid"><article className="card workspace-card"><p className="eyebrow">Your matches</p>{matches.length ? matches.map((match) => <div className="match-row" key={match.id}><div><h2>{match.student?.full_name ?? 'Student'}</h2><p className="muted">{match.status}</p></div>{match.mentor?.full_name && <p>Mentor: {match.mentor.full_name}</p>}</div>) : <p className="muted">Matches appear here when the student has given consent.</p>}</article><section className="card stack-sm"><h2>Your account</h2><p className="muted">Company access is read-only. Messages and session details are private to each student and mentor.</p><Link to="/profile">Update profile</Link></section></section>
      ) : (
        <section className="empty-workspace"><span className="empty-mark" aria-hidden="true">M</span><div><h2>Your workspace is ready</h2><p className="muted">Your dashboard overview will update when you are matched.</p></div></section>
      )}
      <div className="account-links"><Link to="/profile">Profile</Link><Link to="/account">Account</Link></div>
    </div>
  )
}

function MiniCalendar({ sessions }: { sessions: PlatformSession[] }) {
  const [today] = useState(() => new Date())
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const firstWeekday = month.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  const eventCounts = new Map<string, number>()
  for (const session of sessions) {
    const key = localDateParam(new Date(session.starts_at))
    eventCounts.set(key, (eventCounts.get(key) ?? 0) + 1)
  }

  return <section className="mini-calendar" aria-label="Calendar preview">
    <header className="mini-calendar-header">
      <h3>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</h3>
      <div><button className="mini-calendar-nav" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button className="mini-calendar-nav" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
    </header>
    <div className="mini-calendar-grid mini-calendar-weekdays" aria-hidden="true">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
    <div className="mini-calendar-grid">
      {cells.map((day, index) => {
        if (!day) return <span className="mini-calendar-blank" key={`blank-${index}`} />
        const date = new Date(month.getFullYear(), month.getMonth(), day)
        const key = localDateParam(date)
        const eventCount = eventCounts.get(key) ?? 0
        const isToday = key === localDateParam(today)
        return <Link className={`mini-calendar-day${isToday ? ' today' : ''}${eventCount ? ' has-event' : ''}`} key={day} to={`/schedule?date=${key}`} aria-label={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(date)}${eventCount ? `, ${eventCount} events` : ''}`} title={eventCount ? `${eventCount} events` : undefined}>
          {day}{eventCount > 0 && <span className="mini-calendar-dot" aria-hidden="true" />}
        </Link>
      })}
    </div>
  </section>
}

function localDateParam(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

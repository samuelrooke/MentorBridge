import { friendlyError } from '../lib/errors'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReviewDialog, { Stars, type SessionReview } from '../components/ReviewDialog'
import { useViewer } from '../context/viewer'
import { createIcsContent, matchLabel, type PlatformSession } from '../lib/platform'
import { supabase } from '../lib/supabase'
import { useMatches } from '../lib/useMatches'
import { useSessions } from '../lib/useSessions'

type SessionForm = {
  match_id: string
  title: string
  starts_at: string
  duration_min: number
  meeting_url: string
  notes: string
}

const emptyForm = (matchId: string): SessionForm => ({
  match_id: matchId,
  title: '',
  starts_at: '',
  duration_min: 60,
  meeting_url: '',
  notes: '',
})

function dateInputValue(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function displayDate(value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(undefined, options).format(value instanceof Date ? value : new Date(value))
}

export default function Schedule() {
  // Whoever the page shows: the logged-in user, the person an admin views as, or (admin) everyone.
  const { viewer: profile, viewingAs, actorId } = useViewer()
  const adminView = profile?.role === 'admin'
  // Admins (also when viewing as someone) can read reviews but don't write them.
  const canWriteReviews = !adminView && !viewingAs
  const { matches, loading: matchesLoading } = useMatches(profile?.role, profile?.id)
  const { sessions, loading: sessionsLoading } = useSessions(matches)
  const [searchParams] = useSearchParams()
  const [initialDate] = useState(() => parseScheduleDate(searchParams.get('date')))
  const [month, setMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [view, setView] = useState<'month' | 'list'>('month')
  const [referenceTime] = useState(() => new Date().getTime())
  const [form, setForm] = useState<SessionForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviews, setReviews] = useState<SessionReview[]>([])
  const [reviewVersion, setReviewVersion] = useState(0)
  const [reviewing, setReviewing] = useState<PlatformSession | null>(null)
  const reloadReviews = useCallback(() => setReviewVersion((v) => v + 1), [])
  const closeReview = useCallback(() => setReviewing(null), [])

  const matchKey = matches.map((m) => m.id).join(',')
  useEffect(() => {
    const ids = matchKey ? matchKey.split(',') : []
    if (!ids.length) return
    let active = true
    void supabase.from('session_reviews').select('*').in('match_id', ids)
      .then(({ data }) => { if (active) setReviews((data ?? []) as SessionReview[]) })
    return () => { active = false }
  }, [matchKey, reviewVersion])

  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches])
  const monthCells = useMemo(() => {
    const firstWeekday = month.getDay()
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  }, [month])
  const selectedKey = dayKey(selectedDate)
  const selectedSessions = sessions.filter((session) => dayKey(new Date(session.starts_at)) === selectedKey)
  const upcoming = sessions.filter((session) => new Date(session.starts_at).getTime() >= referenceTime)
  const past = sessions.filter((session) => new Date(session.starts_at).getTime() < referenceTime).reverse()

  function startCreate() {
    const firstMatch = matches[0]
    if (!firstMatch) return
    setEditingId(null)
    setForm({ ...emptyForm(firstMatch.id), starts_at: localDateTimeValue(selectedDate) })
    setError(null)
  }

  function changeMonth(amount: number) {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + amount, 1)
    setMonth(nextMonth)
    setSelectedDate(nextMonth)
  }

  function startEdit(session: PlatformSession) {
    setEditingId(session.id)
    setForm({
      match_id: session.match_id,
      title: session.title ?? '',
      starts_at: dateInputValue(session.starts_at),
      duration_min: session.duration_min,
      meeting_url: session.meeting_url ?? '',
      notes: session.notes ?? '',
    })
    setError(null)
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const startsAt = new Date(form.starts_at)
    if (!form.starts_at || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setError('Choose a date and time in the future.')
      return
    }
    let meetingUrl: string | null = null
    if (form.meeting_url.trim()) {
      try {
        const url = new URL(form.meeting_url.trim())
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
        meetingUrl = url.toString()
      } catch {
        setError('Enter a valid link starting with http:// or https://.')
        return
      }
    }

    setSaving(true)
    setError(null)
    const values = {
      match_id: form.match_id,
      title: form.title.trim() || null,
      starts_at: startsAt.toISOString(),
      duration_min: Number(form.duration_min),
      meeting_url: meetingUrl,
      notes: form.notes.trim() || null,
    }
    const result = editingId
      ? await supabase.from('sessions').update(values).eq('id', editingId)
      : await supabase.from('sessions').insert(values)
    setSaving(false)
    if (result.error) {
      setError(friendlyError(result.error))
      return
    }
    setMessage(editingId ? 'Session updated.' : 'Session planned.')
    setForm(null)
  }

  async function deleteSession(sessionId: string) {
    if (!window.confirm('Delete this session?')) return
    const { error: deleteError } = await supabase.from('sessions').delete().eq('id', sessionId)
    if (deleteError) setError(friendlyError(deleteError))
    else setMessage('Session deleted.')
  }

  function downloadIcs(session: PlatformSession) {
    const match = matchById.get(session.match_id)
    const label = otherName(match, profile?.role)
    const blob = new Blob([createIcsContent(session, label)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `mentorbridge-session-${session.id}.ics`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function googleCalendarUrl(session: PlatformSession) {
    const start = new Date(session.starts_at)
    const end = new Date(start.getTime() + session.duration_min * 60_000)
    const dates = `${calendarDate(start)}/${calendarDate(end)}`
    const match = matchById.get(session.match_id)
    const details = [session.notes, session.meeting_url, otherName(match, profile?.role)].filter(Boolean).join('\n')
    const params = new URLSearchParams({ action: 'TEMPLATE', text: session.title || 'MentorBridge session', dates, details })
    return `https://calendar.google.com/calendar/render?${params}`
  }

  // Reviews for one session, and whether the viewer can write one (only after it started).
  function reviewProps(session: PlatformSession): ReviewProps {
    const match = matchById.get(session.match_id)
    const names: Record<string, string> = {}
    if (match) {
      names[match.student_id] = match.student?.full_name ?? 'Student'
      names[match.mentor_id] = match.mentor?.full_name ?? 'Mentor'
    }
    const sessionReviews = reviews.filter((r) => r.session_id === session.id)
    return {
      reviews: sessionReviews,
      reviewNames: names,
      canReview: canWriteReviews && new Date(session.starts_at).getTime() <= referenceTime,
      hasOwnReview: sessionReviews.some((r) => r.author_id === actorId),
      onReview: () => setReviewing(session),
    }
  }

  function moveCalendarDay(date: Date, amount: number) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
    setSelectedDate(next)
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    requestAnimationFrame(() => document.getElementById(`calendar-day-${dayKey(next)}`)?.focus())
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    const movement = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]
    if (movement !== undefined) {
      event.preventDefault()
      moveCalendarDay(date, movement)
    }
  }

  return (
    <div className="stack schedule-page">
      <header className="page-heading">
        <div><p className="eyebrow">{adminView ? 'All matches' : 'Your time together'}</p><h1>{adminView ? 'All sessions' : 'Schedule'}</h1></div>
        {matches.length > 0 && <button className="btn btn-primary" onClick={startCreate}>Plan a session</button>}
      </header>
      {message && <p className="alert alert-info" role="status">{message}</p>}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {matchesLoading && <p className="muted">Loading matches...</p>}
      {!matchesLoading && !matches.length && <p className="alert alert-info" role="status">{adminView ? 'There are no matches yet. Create one under Dashboard → Matches, then plan sessions here.' : 'Your calendar is ready. Sessions will appear here when you have a match.'}</p>}
      <div className="schedule-toolbar">
        <div className="segmented-control" aria-label="Schedule view">
          <button aria-pressed={view === 'month'} onClick={() => setView('month')}>Month</button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
        {view === 'month' && <div className="month-controls"><button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button><h2>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</h2><button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button></div>}
      </div>
      {view === 'month' ? (
            <div className="calendar-layout">
              <section className="calendar-panel" aria-label="Monthly calendar">
                <div className="calendar-grid calendar-weekdays" aria-hidden="true">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
                <div className="calendar-grid calendar-days" role="grid" aria-label={new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}>
                  {monthCells.map((day, index) => {
                    if (!day) return <span className="calendar-blank" key={`blank-${index}`} />
                    const date = new Date(month.getFullYear(), month.getMonth(), day)
                    const daySessions = sessions.filter((session) => dayKey(new Date(session.starts_at)) === dayKey(date))
                    const selected = dayKey(date) === selectedKey
                    return <button id={`calendar-day-${dayKey(date)}`} key={day} role="gridcell" aria-label={`${displayDate(date, { dateStyle: 'full' })}${daySessions.length ? `, ${daySessions.length} sessions` : ''}`} aria-selected={selected} tabIndex={selected ? 0 : -1} className={`calendar-day${selected ? ' selected' : ''}${isSameDay(date, new Date()) ? ' today' : ''}`} onClick={() => setSelectedDate(date)} onKeyDown={(event) => onDayKeyDown(event, date)}><span>{day}</span>{daySessions.length > 0 && <span className="calendar-dot" aria-hidden="true" />}</button>
                  })}
                </div>
              </section>
              <aside className="schedule-agenda">
                <section className="upcoming-events">
                  <p className="eyebrow">Next on your calendar</p>
                  <h2>Upcoming events</h2>
                  {sessionsLoading ? <p className="muted">Loading events...</p> : upcoming.length ? <div className="session-list">{upcoming.map((session) => <SessionItem key={session.id} session={session} match={matchById.get(session.match_id)} role={profile?.role} onEdit={startEdit} onDelete={deleteSession} onIcs={downloadIcs} googleUrl={googleCalendarUrl(session)} {...reviewProps(session)} />)}</div> : <p className="muted">{matches.length ? 'No upcoming events yet.' : 'Upcoming events will appear here after you are matched.'}</p>}
                </section>
                <section className="selected-day-panel">
                  <div className="card-heading"><div><p className="eyebrow">Selected day</p><h2>{displayDate(selectedDate, { dateStyle: 'full' })}</h2></div>{matches.length > 0 && <button className="icon-button" aria-label="Plan session on selected day" onClick={startCreate}>+</button>}</div>
                  {selectedSessions.length ? <div className="session-list">{selectedSessions.map((session) => <SessionItem key={session.id} session={session} match={matchById.get(session.match_id)} role={profile?.role} onEdit={startEdit} onDelete={deleteSession} onIcs={downloadIcs} googleUrl={googleCalendarUrl(session)} {...reviewProps(session)} />)}</div> : <p className="muted">Nothing planned for this day.</p>}
                </section>
              </aside>
            </div>
          ) : (
            <div className="session-list-view">
              <SessionSection title="Upcoming events" sessions={upcoming} matches={matchById} role={profile?.role} onEdit={startEdit} onDelete={deleteSession} onIcs={downloadIcs} googleCalendarUrl={googleCalendarUrl} reviewProps={reviewProps} />
              <SessionSection title="Past" sessions={past} matches={matchById} role={profile?.role} onEdit={startEdit} onDelete={deleteSession} onIcs={downloadIcs} googleCalendarUrl={googleCalendarUrl} reviewProps={reviewProps} />
            </div>
          )}
      {form && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(null) }}><form className="session-dialog stack" role="dialog" aria-modal="true" aria-labelledby="session-dialog-title" onSubmit={saveSession}>
        <div className="card-heading"><h2 id="session-dialog-title">{editingId ? 'Edit session' : 'Plan a session'}</h2><button type="button" className="icon-button" aria-label="Close" onClick={() => setForm(null)}>×</button></div>
        {matches.length > 1 && <label>Match<select required value={form.match_id} onChange={(event) => setForm({ ...form, match_id: event.target.value })}>{matches.map((match) => <option key={match.id} value={match.id}>{otherName(match, profile?.role)}</option>)}</select></label>}
        <label>Title<input maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="For example, interview practice" /></label>
        <label>Date and start time<input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
        <label>Duration<select value={form.duration_min} onChange={(event) => setForm({ ...form, duration_min: Number(event.target.value) })}>{[30, 45, 60, 90].map((minutes) => <option value={minutes} key={minutes}>{minutes} minutes</option>)}</select></label>
        <label>Meeting link<input type="url" value={form.meeting_url} onChange={(event) => setForm({ ...form, meeting_url: event.target.value })} placeholder="https://" /></label>
        <label>Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        {error && <p className="alert alert-error">{error}</p>}
        <div className="dialog-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save session'}</button></div>
      </form></div>}
      {reviewing && (
        <ReviewDialog
          sessionId={reviewing.id}
          matchId={reviewing.match_id}
          sessionTitle={`${reviewing.title || 'MentorBridge session'}, ${displayDate(reviewing.starts_at, { dateStyle: 'medium' })}`}
          otherName={otherName(matchById.get(reviewing.match_id), profile?.role)}
          existing={reviews.find((r) => r.session_id === reviewing.id && r.author_id === actorId) ?? null}
          onClose={closeReview}
          onSaved={reloadReviews}
        />
      )}
    </div>
  )
}

type ReviewProps = {
  reviews: SessionReview[]
  reviewNames: Record<string, string>
  canReview: boolean
  hasOwnReview: boolean
  onReview: () => void
}

function SessionSection({ title, sessions, matches, role, onEdit, onDelete, onIcs, googleCalendarUrl, reviewProps }: {
  title: string
  sessions: PlatformSession[]
  matches: Map<string, ReturnType<typeof useMatches>['matches'][number]>
  role: string | undefined
  onEdit: (session: PlatformSession) => void
  onDelete: (sessionId: string) => void
  onIcs: (session: PlatformSession) => void
  googleCalendarUrl: (session: PlatformSession) => string
  reviewProps: (session: PlatformSession) => ReviewProps
}) {
  return <section className="list-section"><h2>{title}</h2>{sessions.length ? <div className="session-list">{sessions.map((session) => <SessionItem key={session.id} session={session} match={matches.get(session.match_id)} role={role} onEdit={onEdit} onDelete={onDelete} onIcs={onIcs} googleUrl={googleCalendarUrl(session)} {...reviewProps(session)} />)}</div> : <p className="muted">No {title.toLowerCase()} sessions.</p>}</section>
}

function SessionItem({ session, match, role, onEdit, onDelete, onIcs, googleUrl, reviews = [], reviewNames = {}, canReview = false, hasOwnReview = false, onReview }: Partial<ReviewProps> & {
  session: PlatformSession
  match?: ReturnType<typeof useMatches>['matches'][number]
  role: string | undefined
  onEdit: (session: PlatformSession) => void
  onDelete: (sessionId: string) => void
  onIcs: (session: PlatformSession) => void
  googleUrl: string
}) {
  return <article className="session-item"><div className="session-time"><strong>{displayDate(session.starts_at, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><span>{displayDate(session.starts_at, { timeStyle: 'short' })}</span></div><div className="session-info"><h3>{session.title || 'MentorBridge session'}</h3><p className="muted">{session.duration_min} minutes · {otherName(match, role)}</p>{session.notes && <p>{session.notes}</p>}{session.meeting_url && <a href={session.meeting_url} target="_blank" rel="noreferrer">Meeting link</a>}{reviews.length > 0 && <ul className="review-summary">{reviews.map((r) => <li key={r.author_id}><strong>{reviewNames[r.author_id] ?? 'MentorBridge team'}:</strong> {r.took_place && r.rating ? <Stars rating={r.rating} /> : <span className="muted">didn’t take place</span>}{r.went_well && <span className="review-quote"> “{r.went_well}”</span>}{r.to_improve && <span className="review-quote muted"> Could be better: “{r.to_improve}”</span>}</li>)}</ul>}</div><div className="session-actions">{canReview && <button className="text-link review-link" onClick={onReview}>{hasOwnReview ? 'Edit your review' : 'Review this session'}</button>}<button className="text-link" onClick={() => onIcs(session)}>Download .ics</button><a className="text-link" href={googleUrl} target="_blank" rel="noreferrer">Google Calendar</a><button className="text-link" onClick={() => onEdit(session)}>Edit</button><button className="text-link danger-link" onClick={() => onDelete(session.id)}>Delete</button></div></article>
}

function otherName(match: ReturnType<typeof useMatches>['matches'][number] | undefined, role: string | undefined) {
  return matchLabel(match, role)
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function parseScheduleDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date()
  const date = new Date(`${value}T12:00:00`)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}` === value ? date : new Date()
}

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function calendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function isSameDay(first: Date, second: Date) {
  return dayKey(first) === dayKey(second)
}
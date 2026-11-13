import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useViewer } from '../context/viewer'
import {
  MATCH_STATUSES, downloadFile, formatDate, matchesSearch, toCsv,
  type AdminMatch, type AdminUser, type Candidates, type ContactMessage, type MatchStatus, type Overview, type Report, type Suggestion, type WaitlistEntry,
} from '../lib/admin'
import { api } from '../lib/api'
import { supabase, type Profile, type Role } from '../lib/supabase'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'matches', label: 'Matches' },
  { id: 'reports', label: 'Reports' },
  { id: 'waitlist', label: 'Waiting list' },
  { id: 'contact', label: 'Contact' },
] as const
type TabId = (typeof TABS)[number]['id']

const roleLabel: Record<string, string> = { student: 'Student', mentor: 'Mentor', company: 'Company', admin: 'Admin' }
const segmentLabel: Record<string, string> = { student: 'Students', mentor: 'Mentors', company: 'Companies' }
const statusLabel: Record<MatchStatus, string> = { proposed: 'Proposed', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' }

// Loads one admin API path; reload() fetches it again after a change.
function useAdminData<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    api<T>(path)
      .then((data) => { if (active) setState({ data, error: null, loading: false }) })
      .catch((error: Error) => { if (active) setState({ data: null, error: error.message, loading: false }) })
    return () => { active = false }
  }, [path, version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}

// Switches the app to someone's view and opens their dashboard.
function useViewAs() {
  const { setViewingAs } = useViewer()
  const navigate = useNavigate()
  return async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (!data) return
    setViewingAs(data as Profile)
    navigate('/dashboard')
  }
}

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'overview'

  function openTab(id: TabId, extra: Record<string, string> = {}) {
    setSearchParams({ tab: id, ...extra })
  }

  // Arrow keys move between tabs, as in any tab list.
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = TABS[(index + step + TABS.length) % TABS.length]
    openTab(next.id)
    requestAnimationFrame(() => document.getElementById(`admin-tab-${next.id}`)?.focus())
  }

  return (
    <div className="stack admin-dashboard">
      <header className="page-heading admin-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>MentorBridge overview</h1>
          <p className="muted">Everything on the platform and the waiting list. Use “View as” in the top bar to see the platform as any student, mentor or company.</p>
        </div>
      </header>
      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        {TABS.map((t, index) => (
          <button key={t.id} id={`admin-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls="admin-panel" tabIndex={tab === t.id ? 0 : -1}
            onClick={() => openTab(t.id)} onKeyDown={(event) => onTabKeyDown(event, index)}>
            {t.label}
          </button>
        ))}
      </div>
      <section id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className="stack">
        {tab === 'overview' && <OverviewTab openTab={openTab} />}
        {tab === 'users' && <UsersTab initialFilter={searchParams.get('filter') ?? ''} />}
        {tab === 'matches' && <MatchesTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'waitlist' && <WaitlistTab />}
        {tab === 'contact' && <ContactTab />}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function OverviewTab({ openTab }: { openTab: (id: TabId, extra?: Record<string, string>) => void }) {
  const { data, error, loading } = useAdminData<Overview>('/admin/overview')
  if (loading) return <p className="muted">Loading the overview…</p>
  if (error || !data) return <p className="alert alert-error" role="alert">Could not load the overview. {error}</p>

  const attention = [
    { count: data.reports?.open ?? 0, text: 'open reports of misbehaviour', go: () => openTab('reports') },
    { count: data.accounts.unconfirmed, text: 'accounts haven’t confirmed their email', go: () => openTab('users', { filter: 'unconfirmed' }) },
    { count: data.matches.studentsWithoutMatch, text: 'students have no open match', go: () => openTab('matches') },
    { count: data.matches.mentorsWithoutMatch, text: 'mentors have no open match', go: () => openTab('matches') },
    { count: data.matches.byStatus.proposed, text: 'matches are proposed and not active yet', go: () => openTab('matches') },
    { count: data.contact.total, text: 'messages from the contact form', go: () => openTab('contact') },
  ].filter((item) => item.count > 0)
  const maxSource = Math.max(1, ...data.waitlist.bySource.map((s) => s.total))

  return (
    <>
      <div className="admin-kpis" aria-label="Key numbers">
        <Kpi label="Accounts" value={data.accounts.total} detail={`${data.accounts.newLast7Days} new in 7 days · ${data.accounts.unconfirmed} not confirmed`} onClick={() => openTab('users')} />
        <Kpi label="Waiting list" value={data.waitlist.total} detail={`${data.waitlist.last7Days} in the last 7 days`} onClick={() => openTab('waitlist')} />
        <Kpi label="Active matches" value={data.matches.byStatus.active} detail={`${data.matches.byStatus.proposed} proposed · ${data.matches.total} in total`} onClick={() => openTab('matches')} />
        <Kpi label="Upcoming sessions" value={data.sessions.upcoming} detail={`${data.sessions.next7Days} in the next 7 days`} to="/schedule" />
        <Kpi label="Messages" value={data.messages.total} detail={`${data.messages.last7Days} in the last 7 days`} to="/messages" />
        <Kpi label="Contact form" value={data.contact.total} detail="Messages from mentorbridge.nl" onClick={() => openTab('contact')} />
        <Kpi label="Session reviews" value={data.reviews?.total ?? 0}
          detail={data.reviews?.total ? `${data.reviews.average ? `Average ${data.reviews.average} of 5` : 'No ratings yet'} · ${data.reviews.notTookPlace} didn’t take place` : 'No reviews yet'}
          to="/schedule" />
      </div>

      <div className="admin-grid">
        <section className="card stack-sm">
          <h2>Needs attention</h2>
          {attention.length ? (
            <ul className="attention-list">
              {attention.map((item) => (
                <li key={item.text}><button className="attention-item" onClick={item.go}><strong>{item.count}</strong> {item.text}<span aria-hidden="true">→</span></button></li>
              ))}
            </ul>
          ) : <p className="muted">Nothing needs attention right now.</p>}
          <p className="muted small">
            Accounts: {data.accounts.byRole.student} students · {data.accounts.byRole.mentor} mentors · {data.accounts.byRole.company} companies · {data.accounts.byRole.admin} admins
          </p>
        </section>

        <section className="card stack-sm">
          <h2>Sign-ups against the targets</h2>
          <p className="muted small">Accounts plus waiting list entries, each email counted once. The targets are the user numbers set before a payment model (500 students, 1,000 mentors, 50 companies). They are goals, not data.</p>
          <div className="meters">
            {data.waitlist.targets.map((t) => {
              const share = Math.min(100, (t.signups / t.target) * 100)
              return (
                <div className="meter-row" key={t.role}>
                  <div className="meter-label"><span>{segmentLabel[t.role]}</span><span><strong>{t.signups}</strong> of {t.target.toLocaleString('en-GB')}</span></div>
                  <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={t.target} aria-valuenow={t.signups} aria-label={`${segmentLabel[t.role]}: ${t.signups} of ${t.target}`} title={`${t.signups} of ${t.target} (${share.toFixed(1)}%)`}>
                    <span style={{ width: `${Math.max(share, t.signups ? 1 : 0)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="card stack-sm">
          <h2>Where sign-ups come from</h2>
          {data.waitlist.bySource.length ? (
            <ol className="source-bars">
              {data.waitlist.bySource.map((s) => (
                <li key={s.source} title={`${s.source}: ${s.total}`}>
                  <span className="source-name">{s.source}</span>
                  <span className="source-track"><span style={{ width: `${(s.total / maxSource) * 100}%` }} /></span>
                  <span className="source-value">{s.total}</span>
                </li>
              ))}
            </ol>
          ) : <p className="muted">No sign-ups yet.</p>}
          <p className="muted small">UTM source, else the referring site, else “direct”. Page views and conversion per page are in GoatCounter.</p>
        </section>

        <section className="card stack-sm">
          <h2>Upcoming sessions</h2>
          {data.upcomingMatches.length ? (
            <ul className="plain-list">
              {data.upcomingMatches.map((m) => (
                <li key={m.id}><strong>{m.student_name} with {m.mentor_name}</strong><span className="muted">{formatDate(m.next_session_at, true)}</span></li>
              ))}
            </ul>
          ) : <p className="muted">No sessions planned.</p>}
          <Link className="text-link" to="/schedule">Open the calendar</Link>
        </section>

        <section className="card stack-sm admin-wide">
          <h2>Recent activity</h2>
          {data.recent.length ? (
            <ul className="plain-list">
              {data.recent.map((event, index) => (
                <li key={`${event.type}-${event.at}-${index}`}>
                  <span><span className={`activity-type activity-${event.type}`}>{{ account: 'Account', waitlist: 'Waiting list', contact: 'Contact' }[event.type]}</span> <strong>{event.label}</strong> <span className="muted">{event.detail}</span></span>
                  <span className="muted">{formatDate(event.at, true)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing yet.</p>}
        </section>
      </div>
    </>
  )
}

function Kpi({ label, value, detail, onClick, to }: { label: string; value: number; detail: string; onClick?: () => void; to?: string }) {
  const body = <><span className="kpi-label">{label}</span><strong className="kpi-value">{value.toLocaleString('en-GB')}</strong><span className="kpi-detail">{detail}</span></>
  return to ? <Link className="kpi-tile" to={to}>{body}</Link> : <button className="kpi-tile" onClick={onClick}>{body}</button>
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function UsersTab({ initialFilter }: { initialFilter: string }) {
  const { actorId } = useViewer()
  const viewAs = useViewAs()
  const { data, error, loading, reload } = useAdminData<AdminUser[]>('/admin/users')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState(initialFilter === 'unconfirmed' ? '' : initialFilter)
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(initialFilter === 'unconfirmed')
  const [openId, setOpenId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  const users = useMemo(() => (data ?? []).filter((u) =>
    matchesSearch(query, u.full_name, u.email)
    && (!roleFilter || (roleFilter === 'none' ? !u.role : u.role === roleFilter))
    && (!onlyUnconfirmed || !u.confirmed)), [data, query, roleFilter, onlyUnconfirmed])

  async function run(action: () => Promise<unknown>, done: string) {
    setStatus(null)
    try {
      await action()
      setStatus({ text: done })
      reload()
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true })
    }
  }

  function changeRole(user: AdminUser, role: Role) {
    if (role === user.role) return
    const name = user.full_name || user.email
    const note = user.role && user.role !== 'admin' ? ` Their ${user.role} answers are removed.` : ''
    if (!window.confirm(`Make ${name} ${roleLabel[role].toLowerCase()}?${note}`)) return
    void run(() => api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ role }) }), `${name} is now ${roleLabel[role].toLowerCase()}.`)
  }

  function remove(user: AdminUser) {
    const name = user.full_name || user.email
    if (!window.confirm(`Delete ${name}? This removes the account, the profile and every match they are in, with its sessions and messages. It can’t be undone.`)) return
    void run(() => api(`/admin/users/${user.id}`, { method: 'DELETE' }), `${name} is deleted.`)
  }

  return (
    <>
      <div className="admin-filters">
        <label>Search<input type="search" placeholder="Name or email" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label>Role
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {['student', 'mentor', 'company', 'admin'].map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            <option value="none">No profile</option>
          </select>
        </label>
        <label className="checkbox-inline"><input type="checkbox" checked={onlyUnconfirmed} onChange={(e) => setOnlyUnconfirmed(e.target.checked)} /> Only unconfirmed</label>
        <span className="muted filter-count">{users.length} of {data?.length ?? 0}</span>
      </div>
      {status && <p className={`alert ${status.error ? 'alert-error' : 'alert-info'}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      {loading ? <p className="muted">Loading accounts…</p> : error ? <p className="alert alert-error" role="alert">Could not load accounts. {error}</p> : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Matches</th><th>Joined</th><th>Last login</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {users.map((user) => {
                const self = user.id === actorId
                return (
                  <Fragment key={user.id}>
                    <tr>
                      <td><strong>{user.full_name || '–'}</strong><span className="cell-sub">{user.email}</span></td>
                      <td>
                        <select aria-label={`Role of ${user.full_name || user.email}`} value={user.role ?? ''} disabled={self} onChange={(e) => changeRole(user, e.target.value as Role)}>
                          {!user.role && <option value="">No profile</option>}
                          {['student', 'mentor', 'company', 'admin'].map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                        </select>
                      </td>
                      <td>{user.confirmed ? <span className="pill pill-good">Confirmed</span> : (
                        <button className="text-link" onClick={() => void run(() => api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ confirm: true }) }), `${user.email} is confirmed.`)}>Confirm email</button>
                      )}</td>
                      <td>{user.match_count}</td>
                      <td>{formatDate(user.created_at)}</td>
                      <td>{formatDate(user.last_sign_in_at)}</td>
                      <td className="row-actions">
                        {user.role && user.role !== 'admin' && <button className="text-link" onClick={() => void viewAs(user.id)}>View as</button>}
                        <button className="text-link" aria-expanded={openId === user.id} onClick={() => setOpenId(openId === user.id ? null : user.id)}>Answers</button>
                        {!self && <button className="text-link danger-link" onClick={() => remove(user)}>Delete</button>}
                      </td>
                    </tr>
                    {openId === user.id && (
                      <tr className="detail-row"><td colSpan={7}><Answers user={user} /></td></tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {!users.length && <p className="muted centered">No accounts match these filters.</p>}
        </div>
      )}
    </>
  )
}

const hiddenAnswerKeys = new Set(['id', 'updated_at', 'created_at'])
function Answers({ user }: { user: AdminUser }) {
  const entries = Object.entries(user.answers ?? {}).filter(([key, value]) => !hiddenAnswerKeys.has(key) && value !== null && value !== '')
  return (
    <div className="answers">
      {user.bio && <p><strong>About:</strong> {user.bio}</p>}
      {entries.length ? (
        <dl className="details">
          {entries.map(([key, value]) => <Fragment key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{String(value)}</dd></Fragment>)}
        </dl>
      ) : <p className="muted">No profile answers yet.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

function MatchesTab() {
  const viewAs = useViewAs()
  const matches = useAdminData<AdminMatch[]>('/admin/matches')
  const candidates = useAdminData<Candidates>('/admin/candidates')
  const suggestions = useAdminData<Suggestion[]>('/admin/suggestions')
  const [form, setForm] = useState({ student_id: '', mentor_id: '', company_id: '', status: 'active' as MatchStatus })
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  const reloadAll = () => { matches.reload(); suggestions.reload() }
  async function run(action: () => Promise<unknown>, done: string) {
    setStatus(null)
    try {
      await action()
      setStatus({ text: done })
      reloadAll()
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true })
    }
  }

  function create(event: FormEvent) {
    event.preventDefault()
    void run(async () => {
      await api('/admin/matches', { method: 'POST', body: JSON.stringify({ ...form, company_id: form.company_id || null }) })
      setForm({ student_id: '', mentor_id: '', company_id: '', status: 'active' })
    }, 'Match created.')
  }

  const label = (p: { full_name: string | null; email: string | null }) => p.full_name || p.email || 'Unknown'
  const visible = (matches.data ?? []).filter((m) => matchesSearch(query, m.student_name, m.mentor_name, m.company_name) && (!statusFilter || m.status === statusFilter))

  return (
    <>
      {status && <p className={`alert ${status.error ? 'alert-error' : 'alert-info'}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      <div className="admin-grid">
        <form className="card stack-sm" onSubmit={create}>
          <h2>New match</h2>
          {candidates.error && <p className="alert alert-error">{candidates.error}</p>}
          <label>Student
            <select required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">Choose…</option>
              {candidates.data?.students.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
            </select>
          </label>
          <label>Mentor
            <select required value={form.mentor_id} onChange={(e) => setForm({ ...form, mentor_id: e.target.value })}>
              <option value="">Choose…</option>
              {candidates.data?.mentors.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
            </select>
          </label>
          <label>Company (optional)
            <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
              <option value="">None</option>
              {candidates.data?.companies.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
            </select>
          </label>
          <label>Status
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MatchStatus })}>
              {MATCH_STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
            </select>
          </label>
          <button className="btn btn-primary">Create match</button>
        </form>

        <section className="card stack-sm">
          <h2>Suggested by shared topics</h2>
          <p className="muted small">Students and mentors who picked the same topics and aren’t matched yet.</p>
          {suggestions.loading ? <p className="muted">Looking for pairs…</p> : suggestions.data?.length ? (
            <ul className="plain-list">
              {suggestions.data.slice(0, 12).map((s) => (
                <li key={`${s.student_id}-${s.mentor_id}`}>
                  <span><strong>{s.student_name} with {s.mentor_name}</strong><span className="cell-sub">Shared: {s.keywords.join(', ')}</span></span>
                  <button className="btn btn-ghost btn-sm" onClick={() => void run(() => api('/admin/matches', { method: 'POST', body: JSON.stringify({ student_id: s.student_id, mentor_id: s.mentor_id, status: 'active' }) }), `Matched ${s.student_name} with ${s.mentor_name}.`)}>Match</button>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No suggestions. They appear when a student and a mentor pick the same topics in their profiles.</p>}
        </section>
      </div>

      <div className="admin-filters">
        <label>Search<input type="search" placeholder="Student, mentor or company" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label>Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            {MATCH_STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
          </select>
        </label>
        <span className="muted filter-count">{visible.length} of {matches.data?.length ?? 0}</span>
      </div>
      {matches.loading ? <p className="muted">Loading matches…</p> : matches.error ? <p className="alert alert-error" role="alert">Could not load matches. {matches.error}</p> : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>Student and mentor</th><th>Company</th><th>Status</th><th>Sessions</th><th>Messages</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td><strong>{m.student_name}</strong><span className="cell-sub">with {m.mentor_name}</span></td>
                  <td>
                    <select aria-label={`Company for ${m.student_name}`} value={m.company_id ?? ''} onChange={(e) => void run(() => api(`/admin/matches/${m.id}`, { method: 'PATCH', body: JSON.stringify({ company_id: e.target.value || null }) }), 'Company changed.')}>
                      <option value="">None</option>
                      {candidates.data?.companies.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}
                    </select>
                  </td>
                  <td>
                    <select aria-label={`Status of ${m.student_name} with ${m.mentor_name}`} value={m.status} onChange={(e) => void run(() => api(`/admin/matches/${m.id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }), 'Status changed.')}>
                      {MATCH_STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                    </select>
                  </td>
                  <td>{m.session_count}<span className="cell-sub">{m.next_session_at ? `Next ${formatDate(m.next_session_at, true)}` : 'None planned'}</span></td>
                  <td>{m.message_count}<span className="cell-sub">{m.last_message_at ? `Last ${formatDate(m.last_message_at, true)}` : 'No messages'}</span></td>
                  <td>{formatDate(m.created_at)}</td>
                  <td className="row-actions">
                    <Link className="text-link" to={`/messages?match=${m.id}`}>Conversation</Link>
                    <Link className="text-link" to="/schedule">Calendar</Link>
                    <button className="text-link" onClick={() => void viewAs(m.student_id)}>View as student</button>
                    <button className="text-link" onClick={() => void viewAs(m.mentor_id)}>View as mentor</button>
                    <button className="text-link danger-link" onClick={() => {
                      if (window.confirm(`Delete the match between ${m.student_name} and ${m.mentor_name}? Its sessions, messages and plan are deleted too.`)) {
                        void run(() => api(`/admin/matches/${m.id}`, { method: 'DELETE' }), 'Match deleted.')
                      }
                    }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length && <p className="muted centered">{matches.data?.length ? 'No matches fit these filters.' : 'No matches yet. Create one above.'}</p>}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const reasonLabel: Record<Report['reason'], string> = {
  harassment: 'Harassment or bullying',
  inappropriate: 'Inappropriate or offensive content',
  spam: 'Spam or advertising',
  safety: 'Feels unsafe',
  other: 'Something else',
}

function ReportsTab() {
  const { data, error, loading, reload } = useAdminData<Report[]>('/admin/reports')
  const [show, setShow] = useState<'open' | 'resolved' | 'all'>('open')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const reports = (data ?? []).filter((r) => show === 'all' || r.status === show)
  const openCount = (data ?? []).filter((r) => r.status === 'open').length

  async function run(action: () => Promise<unknown>, done: string) {
    setStatus(null)
    try {
      await action()
      setStatus({ text: done })
      reload()
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true })
    }
  }

  return (
    <>
      <div className="admin-filters">
        <div className="segmented-control" role="group" aria-label="Which reports">
          {(['open', 'resolved', 'all'] as const).map((value) => (
            <button key={value} aria-pressed={show === value} onClick={() => setShow(value)}>
              {value === 'open' ? `Open (${openCount})` : value === 'resolved' ? 'Resolved' : 'All'}
            </button>
          ))}
        </div>
      </div>
      {status && <p className={`alert ${status.error ? 'alert-error' : 'alert-info'}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      {loading ? <p className="muted">Loading reports…</p> : error ? <p className="alert alert-error" role="alert">Could not load reports. {error}</p> : reports.length ? (
        <div className="report-list">
          {reports.map((r) => (
            <article key={r.id} className={`card stack-sm report-card${r.status === 'open' ? ' open' : ''}`}>
              <div className="card-heading">
                <div>
                  <p className="eyebrow">{reasonLabel[r.reason]}</p>
                  <h2>{r.reporter_name ?? 'Someone'} reported {r.reported_name ?? 'a person'}</h2>
                  <p className="muted small">
                    {r.reporter_role ? `${roleLabel[r.reporter_role] ?? r.reporter_role} → ` : ''}{r.reported_role ? roleLabel[r.reported_role] ?? r.reported_role : ''}
                    {r.match_label ? ` · Match: ${r.match_label}` : ''} · {formatDate(r.created_at, true)}
                  </p>
                </div>
                <span className={`pill ${r.status === 'open' ? 'pill-open' : 'pill-good'}`}>{r.status === 'open' ? 'Open' : 'Resolved'}</span>
              </div>
              {r.message_id && (
                <blockquote className="report-quote">
                  {r.message_snapshot || (r.message_had_picture ? '' : '(empty message)')}
                  {r.message_had_picture && <span className="muted small">{r.message_snapshot ? ' · ' : ''}The message had a picture.</span>}
                </blockquote>
              )}
              {r.details && <p><strong>Reporter’s details:</strong> {r.details}</p>}
              <label className="w-full">Team note (only admins see this)
                <textarea rows={2} maxLength={2000} value={notes[r.id] ?? r.admin_note ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              </label>
              <div className="row-actions">
                {notes[r.id] !== undefined && notes[r.id] !== (r.admin_note ?? '') && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void run(() => api(`/admin/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ admin_note: notes[r.id] }) }), 'Note saved.')}>Save note</button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => void run(() => api(`/admin/reports/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status: r.status === 'open' ? 'resolved' : 'open', ...(notes[r.id] !== undefined ? { admin_note: notes[r.id] } : {}) }) }), r.status === 'open' ? 'Marked as resolved.' : 'Reopened.')}>
                  {r.status === 'open' ? 'Mark resolved' : 'Reopen'}
                </button>
                {r.match_id && <Link className="text-link" to={`/messages?match=${r.match_id}`}>Open the conversation</Link>}
                {r.message_id && (
                  <button className="text-link danger-link" onClick={() => {
                    if (window.confirm('Delete the reported message for everyone? The report keeps its copy.')) void run(() => api(`/admin/messages/${r.message_id}`, { method: 'DELETE' }), 'Message deleted.')
                  }}>Delete the message</button>
                )}
                {r.match_id && (
                  <button className="text-link danger-link" onClick={() => {
                    if (window.confirm('Stop this match? Its status becomes “cancelled”. Messages stay readable for the team.')) void run(() => api(`/admin/matches/${r.match_id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }), 'Match stopped.')
                  }}>Stop the match</button>
                )}
                {r.reported_user_id && (
                  <button className="text-link danger-link" onClick={() => {
                    if (window.confirm(`Delete the account of ${r.reported_name}? This removes their profile and every match they are in, with its messages. It can’t be undone.`)) void run(() => api(`/admin/users/${r.reported_user_id}`, { method: 'DELETE' }), 'Account deleted.')
                  }}>Delete their account</button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted">{show === 'open' ? 'No open reports.' : 'No reports here.'}</p>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Waiting list
// ---------------------------------------------------------------------------

const WAITLIST_COLUMNS = [
  'created_at', 'role', 'name', 'email', 'company', 'job_title', 'sector', 'company_size', 'interest', 'age_range', 'hours_per_month',
  'availability', 'skills_help', 'has_placement', 'applications_sent', 'help_wanted', 'needed_by', 'utm_source', 'utm_medium',
  'utm_campaign', 'referrer', 'landing_path', 'consent_at',
]
const DETAIL_KEYS: Record<string, string[]> = {
  company: ['company', 'job_title', 'sector', 'company_size', 'interest'],
  mentor: ['age_range', 'hours_per_month', 'availability', 'sector'],
  student: ['sector', 'skills_help', 'availability', 'has_placement', 'applications_sent', 'help_wanted', 'needed_by'],
}

function WaitlistTab() {
  const { data, error, loading, reload } = useAdminData<WaitlistEntry[]>('/admin/waitlist')
  const [segment, setSegment] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const rows = (data ?? []).filter((r) => (!segment || r.role === segment)
    && matchesSearch(query, r.name, r.email, String(r.utm_source ?? ''), String(r.referrer ?? ''), String(r.company ?? '')))

  async function remove(entry: WaitlistEntry) {
    if (!window.confirm(`Remove ${entry.name || entry.email} from the waiting list? Use this when someone asks to be removed.`)) return
    try {
      await api(`/admin/waitlist/${entry.id}`, { method: 'DELETE' })
      setStatus({ text: `${entry.email} is removed.` })
      reload()
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true })
    }
  }

  return (
    <>
      <div className="admin-filters">
        <label>Search<input type="search" placeholder="Name, email, company or source" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label>Group
          <select value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">Everyone</option>
            {Object.entries(segmentLabel).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </label>
        <span className="muted filter-count">{rows.length} of {data?.length ?? 0}</span>
        <button className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => downloadFile(`mentorbridge-waiting-list-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, WAITLIST_COLUMNS))}>
          Export CSV
        </button>
      </div>
      {status && <p className={`alert ${status.error ? 'alert-error' : 'alert-info'}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      {loading ? <p className="muted">Loading the waiting list…</p> : error ? <p className="alert alert-error" role="alert">Could not load the waiting list. {error}</p> : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead><tr><th>Date</th><th>Group</th><th>Name</th><th>Details</th><th>Source</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.created_at, true)}</td>
                  <td>{roleLabel[r.role] ?? r.role}</td>
                  <td><strong>{r.name || '–'}</strong><a className="cell-sub" href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td className="cell-details">
                    {(DETAIL_KEYS[r.role] ?? []).filter((key) => r[key] !== null && r[key] !== undefined && r[key] !== '').map((key) => (
                      <span key={key}><span className="muted">{key.replace(/_/g, ' ')}:</span> {Array.isArray(r[key]) ? (r[key] as string[]).join(', ') : String(r[key])}</span>
                    ))}
                  </td>
                  <td>{String(r.utm_source ?? r.referrer ?? 'direct')}<span className="cell-sub">{String(r.landing_path ?? '')}</span></td>
                  <td className="row-actions"><button className="text-link danger-link" onClick={() => void remove(r)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="muted centered">No sign-ups match these filters.</p>}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

function ContactTab() {
  const { data, error, loading, reload } = useAdminData<ContactMessage[]>('/admin/contact')
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)

  async function remove(message: ContactMessage) {
    if (!window.confirm(`Delete the message from ${message.name || message.email}?`)) return
    try {
      await api(`/admin/contact/${message.id}`, { method: 'DELETE' })
      setStatus({ text: 'Message deleted.' })
      reload()
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true })
    }
  }

  if (loading) return <p className="muted">Loading messages…</p>
  if (error) return <p className="alert alert-error" role="alert">Could not load messages. {error}</p>
  return (
    <>
      {status && <p className={`alert ${status.error ? 'alert-error' : 'alert-info'}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      {data?.length ? (
        <div className="contact-list">
          {data.map((m) => (
            <article className="card stack-sm" key={m.id}>
              <div className="card-heading">
                <div><h2>{m.name || m.email}</h2><a href={`mailto:${m.email}`}>{m.email}</a></div>
                <span className="muted">{formatDate(m.created_at, true)}</span>
              </div>
              <p className="message-text">{m.message}</p>
              <div className="row-actions">
                <a className="btn btn-ghost btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent('Your message to MentorBridge')}`}>Reply by email</a>
                <button className="text-link danger-link" onClick={() => void remove(m)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted">No messages from the contact form.</p>}
    </>
  )
}

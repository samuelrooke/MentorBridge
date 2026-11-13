import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useViewer } from '../context/viewer'
import { formatDate } from '../lib/admin'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'

type Intern = {
  match_id: string
  status: 'proposed' | 'active' | 'completed' | 'cancelled'
  matched_at: string
  student_name: string
  mentor_name: string
  sessions_held: number
  sessions_planned: number
  plan_done: number
  plan_total: number
}
type Overview = { waitingForConsent: number; interns: Intern[] }
type Brief = { organisation_name: string | null; internship_position: string | null; expectations: string | null; tools: string | null; first_tasks: string | null }

const statusLabel = { proposed: 'Starting soon', active: 'Active', completed: 'Completed', cancelled: 'Stopped' }

// What a company sees on the platform. Students decide whether a company sees their match;
// the company then gets names, session counts and plan progress, never messages or session details.
export default function CompanyDashboard() {
  const { viewer, viewingAs } = useViewer()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [error, setError] = useState<string | null>(null)
  const firstName = viewer?.full_name?.trim().split(/\s+/)[0]

  useEffect(() => {
    if (!viewer) return
    let active = true
    // An admin viewing as a company uses the admin route; the company route only answers companies.
    const path = viewingAs ? `/admin/company/${viewer.id}/overview` : '/company/overview'
    api<Overview>(path)
      .then((data) => { if (active) setOverview(data) })
      .catch((e: Error) => { if (active) setError(e.message) })
    void supabase.from('company_profiles').select('organisation_name, internship_position, expectations, tools, first_tasks').eq('id', viewer.id).maybeSingle()
      .then(({ data }) => { if (active) setBrief((data ?? null) as Brief | null) })
    return () => { active = false }
  }, [viewer, viewingAs])

  const interns = overview?.interns ?? []
  const held = interns.reduce((total, i) => total + i.sessions_held, 0)
  const planned = interns.reduce((total, i) => total + i.sessions_planned, 0)
  const stepsDone = interns.reduce((total, i) => total + i.plan_done, 0)
  const stepsTotal = interns.reduce((total, i) => total + i.plan_total, 0)
  const briefFields: [keyof Brief, string][] = [
    ['internship_position', 'Internship position'],
    ['expectations', 'What you expect from interns'],
    ['tools', 'Tools they will use'],
    ['first_tasks', 'Typical first tasks'],
  ]
  const briefFilled = briefFields.filter(([key]) => brief?.[key]?.trim()).length

  return (
    <div className="stack company-dashboard">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Company</p>
          <h1>{brief?.organisation_name || (firstName ? `Hello, ${firstName}` : 'Your company')}</h1>
          <p className="muted">Follow your interns’ preparation with their MentorBridge mentor. Students choose whether to share their progress with you.</p>
        </div>
      </header>

      {error && <p className="alert alert-error" role="alert">Could not load your interns. {error}</p>}

      <div className="admin-kpis" aria-label="Your numbers">
        <div className="kpi-tile static"><span className="kpi-label">Interns sharing with you</span><strong className="kpi-value">{interns.length}</strong><span className="kpi-detail">{overview?.waitingForConsent ? `${overview.waitingForConsent} not shared yet` : 'Students choose to share'}</span></div>
        <div className="kpi-tile static"><span className="kpi-label">Sessions held</span><strong className="kpi-value">{held}</strong><span className="kpi-detail">{planned} planned</span></div>
        <div className="kpi-tile static"><span className="kpi-label">Plan steps done</span><strong className="kpi-value">{stepsDone}</strong><span className="kpi-detail">of {stepsTotal}</span></div>
      </div>

      <section className="card stack-sm">
        <h2>Your interns</h2>
        {!overview ? <p className="muted">Loading…</p> : interns.length ? (
          <ul className="intern-list">
            {interns.map((intern) => {
              const share = intern.plan_total ? Math.round((intern.plan_done / intern.plan_total) * 100) : 0
              return (
                <li key={intern.match_id} className="intern-item">
                  <div className="intern-names">
                    <strong>{intern.student_name}</strong>
                    <span className="muted">Mentor: {intern.mentor_name} · since {formatDate(intern.matched_at)}</span>
                  </div>
                  <span className={`pill pill-${intern.status}`}>{statusLabel[intern.status]}</span>
                  <div className="intern-progress">
                    <span>{intern.sessions_held} {intern.sessions_held === 1 ? 'session' : 'sessions'} held · {intern.sessions_planned} planned</span>
                    <div className="meter-label"><span>Plan</span><span>{intern.plan_total ? `${intern.plan_done} of ${intern.plan_total} steps` : 'No plan steps yet'}</span></div>
                    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={intern.plan_total || 1} aria-valuenow={intern.plan_done} aria-label={`Plan progress for ${intern.student_name}`}>
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="stack-sm">
            <p className="muted">{overview.waitingForConsent ? `You have ${overview.waitingForConsent} matched ${overview.waitingForConsent === 1 ? 'intern' : 'interns'}. You’ll see their progress here once they choose to share it.` : 'No interns yet. This is how it works:'}</p>
            {!overview.waitingForConsent && (
              <ol className="steps-list">
                <li><strong>Fill in your internship brief</strong> so mentors know what your interns need.</li>
                <li><strong>The MentorBridge team matches</strong> your intern with an experienced mentor from your field.</li>
                <li><strong>Your intern shares their progress</strong> with you, and you follow it here.</li>
              </ol>
            )}
          </div>
        )}
        <p className="muted small">You never see messages or session details. Those stay between the student and the mentor.</p>
      </section>

      <div className="admin-grid">
        <section className="card stack-sm">
          <div className="card-heading"><h2>Your internship brief</h2><span className="muted small">{briefFilled} of {briefFields.length} filled in</span></div>
          <dl className="brief-list">
            {briefFields.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd className={brief?.[key] ? '' : 'muted'}>{brief?.[key] || 'Not filled in yet'}</dd></div>
            ))}
          </dl>
          {!viewingAs && <Link className="btn btn-ghost btn-sm" to="/profile">{briefFilled ? 'Edit the brief' : 'Fill in the brief'}</Link>}
        </section>

        <section className="card stack-sm">
          <h2>Your own staff as mentors</h2>
          <p>Experienced or retiring colleagues can mentor your interns through MentorBridge, so their know-how stays in the company. Tell us who might want to, and we’ll set it up with you.</p>
          <ContactTeam
            name={viewer?.full_name ?? ''}
            email={viewer?.email ?? ''}
            disabled={Boolean(viewingAs)}
            placeholder="For example: two of our senior engineers would like to mentor our interns this spring."
          />
        </section>
      </div>
    </div>
  )
}

function ContactTeam({ name, email, disabled, placeholder }: { name: string; email: string; disabled: boolean; placeholder: string }) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
  const [sending, setSending] = useState(false)

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!message.trim()) return
    setSending(true)
    setStatus(null)
    try {
      await api('/contact', { method: 'POST', body: JSON.stringify({ name: name || email, email, message: message.trim() }) })
      setMessage('')
      setStatus({ text: 'Sent. We usually reply by email within a few days.' })
    } catch (e) {
      setStatus({ text: (e as Error).message, error: true })
    } finally {
      setSending(false)
    }
  }

  return (
    <form className="stack-sm w-full" onSubmit={send}>
      <label className="w-full">Message to the MentorBridge team
        <textarea rows={3} maxLength={2000} value={message} disabled={disabled} placeholder={placeholder} onChange={(event) => setMessage(event.target.value)} />
      </label>
      {status && <p className={`alert ${status.error ? 'alert-error' : 'alert-info'}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
      <button className="btn btn-primary btn-sm" disabled={disabled || sending || !message.trim()}>{sending ? 'Sending…' : 'Send to the team'}</button>
      {disabled && <p className="muted small">Viewing as this company: sending is off.</p>}
    </form>
  )
}

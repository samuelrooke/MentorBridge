import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useViewer } from '../context/viewer'
import { friendlyError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { useMatches, type MatchRecord } from '../lib/useMatches'

const roleLabels = { student: 'mentor', mentor: 'student', company: 'match', admin: 'match' }

export default function Matching() {
  const { viewer: profile, viewingAs } = useViewer()
  const { matches, loading, error } = useMatches(profile?.role, profile?.id)
  // Admins manage all matches in the admin dashboard.
  if (profile?.role === 'admin') return <Navigate to="/dashboard?tab=matches" replace />
  const otherRole = profile ? roleLabels[profile.role] : 'match'

  return (
    <div className="stack matching-page">
      <header className="page-heading">
        <div><p className="eyebrow">Your MentorBridge connection</p><h1>Mentor matching</h1></div>
      </header>
      {error && <p className="alert alert-error" role="alert">Could not load your matching status: {error}</p>}
      {loading ? <p className="muted">Checking your matching status...</p> : matches.length ? (
        <section className="matching-list" aria-label="Your matches">
          {matches.map((match) => {
            const person = profile?.role === 'student' ? match.mentor : match.student
            return <article className="matching-person" key={match.id}>
              <span className="matching-avatar" aria-hidden="true">{(person?.full_name ?? '?').slice(0, 1).toUpperCase()}</span>
              <div className="matching-person-copy">
                <p className="eyebrow">Your {otherRole}</p>
                <h2>{person?.full_name ?? 'Your match'}</h2>
                <p className="muted">Status: {match.status}{match.company?.full_name ? ` · ${match.company.full_name}` : ''}</p>
              </div>
              <Link className="btn btn-primary btn-sm" to={`/messages?match=${match.id}`}>Open messages</Link>
              {profile?.role === 'student' && match.company_id && <CompanyConsent match={match} readOnly={Boolean(viewingAs)} />}
            </article>
          })}
        </section>
      ) : (
        <section className="matching-empty">
          <div className="matching-empty-mark" aria-hidden="true">M</div>
          <div>
            <p className="eyebrow">Status: looking for a match</p>
            <h2>We are working on your match.</h2>
            <p className="muted">A member of the MentorBridge team matches students and mentors by hand. We will email you when there is an update.</p>
            <Link className="text-link" to="/profile">Review your profile</Link>
          </div>
        </section>
      )}
    </div>
  )
}

// A company only sees a match after the student shares it. The student can stop at any time.
function CompanyConsent({ match, readOnly }: { match: MatchRecord; readOnly: boolean }) {
  const [shared, setShared] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const company = match.company?.full_name || 'your company'

  useEffect(() => {
    let active = true
    void supabase.from('consents').select('revoked_at').eq('match_id', match.id).maybeSingle()
      .then(({ data }) => { if (active) setShared(Boolean(data && !data.revoked_at)) })
    return () => { active = false }
  }, [match.id])

  async function change(next: boolean) {
    setBusy(true)
    setError(null)
    const now = new Date().toISOString()
    const result = next
      ? await supabase.from('consents').upsert({ match_id: match.id, student_id: match.student_id, granted_at: now, revoked_at: null }, { onConflict: 'match_id' })
      : await supabase.from('consents').update({ revoked_at: now }).eq('match_id', match.id)
    setBusy(false)
    if (result.error) setError(friendlyError(result.error))
    else setShared(next)
  }

  if (shared === null) return null
  return (
    <div className="consent-box">
      <p>
        <strong>{shared ? `You share your progress with ${company}.` : `Share your progress with ${company}?`}</strong>{' '}
        They see your name, your mentor’s name, how many sessions you’ve had and your plan steps. Never your messages or session details.
      </p>
      {readOnly ? <p className="muted small">Only the student can change this.</p> : (
        <button className={`btn btn-sm ${shared ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => void change(!shared)}>
          {busy ? 'Saving…' : shared ? 'Stop sharing' : `Share with ${company}`}
        </button>
      )}
      {error && <p className="alert alert-error" role="alert">{error}</p>}
    </div>
  )
}

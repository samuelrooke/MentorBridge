import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useMatches } from '../lib/useMatches'

const roleLabels = { student: 'mentor', mentor: 'student', company: 'match', admin: 'match' }

export default function Matching() {
  const { profile } = useAuth()
  const { matches, loading, error } = useMatches(profile?.role, profile?.id)
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
              <Link className="btn btn-primary btn-sm" to="/messages">Open messages</Link>
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
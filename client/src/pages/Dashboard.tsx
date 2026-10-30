import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

type Match = {
  id: string
  status: string
  student: { full_name: string | null } | null
  mentor: { full_name: string | null } | null
  company: { full_name: string | null } | null
}

const nextSteps = {
  student: 'Fill in your field of study, internship and learning goals so we can match you with a mentor.',
  company: 'Describe the internship position, the tools you use and the first tasks your intern will do.',
  mentor: 'Tell students about your professional background, expertise and availability.',
  admin: 'Review new sign-ups and match students with suitable mentors.',
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Match[]>('/me/matches').then(setMatches).catch((e: Error) => setError(e.message))
  }, [])

  if (!profile) return <p className="muted">Loading profile…</p>

  return (
    <div className="stack">
      <h1>Welcome{profile.full_name ? `, ${profile.full_name}` : ''}</h1>

      <section className="card stack-sm">
        <h2>Next step</h2>
        <p className="muted">{nextSteps[profile.role]}</p>
        <Link className="btn btn-primary" to={profile.role === 'admin' ? '/admin' : '/profile'}>
          {profile.role === 'admin' ? 'Go to matching' : 'Complete your profile'}
        </Link>
      </section>

      <section className="card stack-sm">
        <h2>Your matches</h2>
        {error && <p className="alert alert-error">Could not reach the API: {error}</p>}
        {!error && matches.length === 0 && <p className="muted">No matches yet.</p>}
        <ul className="list">
          {matches.map((m) => (
            <li key={m.id}>
              <span>
                <strong>{m.student?.full_name ?? 'Student'}</strong> with {m.mentor?.full_name ?? 'mentor'}
                {m.company && <> for {m.company.full_name}</>}
              </span>
              <span className="badge">{m.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

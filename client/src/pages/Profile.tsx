import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase, type Role } from '../lib/supabase'

type Field = { name: string; label: string; type?: 'text' | 'textarea' | 'date' }

// Intake questions per role, stored in the matching *_profiles table.
const intake: Record<Exclude<Role, 'admin'>, { table: string; fields: Field[] }> = {
  student: {
    table: 'student_profiles',
    fields: [
      { name: 'field_of_study', label: 'Field of study' },
      { name: 'internship_type', label: 'Internship type or role' },
      { name: 'internship_start', label: 'Internship start date', type: 'date' },
      { name: 'interests', label: 'Interests', type: 'textarea' },
      { name: 'learning_goals', label: 'What do you want to be ready for?', type: 'textarea' },
    ],
  },
  company: {
    table: 'company_profiles',
    fields: [
      { name: 'organisation_name', label: 'Organisation name' },
      { name: 'internship_position', label: 'Internship position' },
      { name: 'expectations', label: 'What do you expect from the intern?', type: 'textarea' },
      { name: 'tools', label: 'Tools the intern will use', type: 'textarea' },
      { name: 'first_tasks', label: 'Typical first tasks', type: 'textarea' },
    ],
  },
  mentor: {
    table: 'mentor_profiles',
    fields: [
      { name: 'background', label: 'Professional background', type: 'textarea' },
      { name: 'expertise', label: 'Areas of expertise', type: 'textarea' },
      { name: 'availability', label: 'Availability (e.g. 2 hours a week, evenings)' },
    ],
  },
}

export default function Profile() {
  const { profile } = useAuth()
  const [values, setValues] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const config = profile && profile.role !== 'admin' ? intake[profile.role] : null

  useEffect(() => {
    if (!profile || !config) return
    supabase
      .from(config.table)
      .select('*')
      .eq('id', profile.id)
      .maybeSingle()
      .then(({ data }) => setValues(data ?? {}))
  }, [profile, config])

  if (!profile) return null
  if (!config) return <p className="muted">Admins don't have an intake profile.</p>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile || !config) return
    const row = Object.fromEntries(config.fields.map((f) => [f.name, values[f.name] || null]))
    const { error } = await supabase
      .from(config.table)
      .upsert({ id: profile.id, ...row, updated_at: new Date().toISOString() })
    setStatus(error ? `Could not save: ${error.message}` : 'Saved.')
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h1>Your profile</h1>
      {config.fields.map((f) => (
        <label key={f.name}>
          {f.label}
          {f.type === 'textarea' ? (
            <textarea
              rows={3}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          ) : (
            <input
              type={f.type ?? 'text'}
              value={values[f.name] ?? ''}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          )}
        </label>
      ))}
      {status && <p className="alert alert-info">{status}</p>}
      <button className="btn btn-primary">Save profile</button>
    </form>
  )
}

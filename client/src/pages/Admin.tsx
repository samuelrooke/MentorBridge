import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'

type Person = { id: string; full_name: string | null; email: string | null }
type Candidates = { students: Person[]; mentors: Person[]; companies: Person[] }

// Manual matching. Goes through the Node backend, which uses the service-role key.
export default function Admin() {
  const [candidates, setCandidates] = useState<Candidates | null>(null)
  const [form, setForm] = useState({ student_id: '', mentor_id: '', company_id: '' })
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    api<Candidates>('/admin/candidates').then(setCandidates).catch((e: Error) => setStatus(e.message))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await api('/admin/matches', {
        method: 'POST',
        body: JSON.stringify({ ...form, company_id: form.company_id || null }),
      })
      setStatus('Match created.')
      setForm({ student_id: '', mentor_id: '', company_id: '' })
    } catch (err) {
      setStatus((err as Error).message)
    }
  }

  const select = (key: keyof typeof form, label: string, people: Person[] = [], required = true) => (
    <label>
      {label}
      <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={required}>
        <option value="">{required ? 'Choose…' : 'None'}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name ?? p.email}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h1>Manual matching</h1>
      {select('student_id', 'Student', candidates?.students)}
      {select('mentor_id', 'Mentor', candidates?.mentors)}
      {select('company_id', 'Company (optional)', candidates?.companies, false)}
      {status && <p className="alert alert-info">{status}</p>}
      <button className="btn btn-primary">Create match</button>
    </form>
  )
}

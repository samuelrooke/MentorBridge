import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useViewer } from '../context/viewer'
import { supabase, type Profile } from '../lib/supabase'

const groups: { role: Profile['role']; label: string }[] = [
  { role: 'student', label: 'Students' },
  { role: 'mentor', label: 'Mentors' },
  { role: 'company', label: 'Companies' },
]

// Admins pick whose view of the platform to see. "Admin view" shows everything.
export default function ViewAsSwitcher() {
  const { viewingAs, setViewingAs } = useViewer()
  const navigate = useNavigate()
  const [people, setPeople] = useState<Profile[]>([])

  useEffect(() => {
    let active = true
    void supabase.from('profiles').select('*').neq('role', 'admin').order('full_name')
      .then(({ data }) => { if (active) setPeople((data ?? []) as Profile[]) })
    return () => { active = false }
  }, [])

  function choose(id: string) {
    setViewingAs(people.find((person) => person.id === id) ?? null)
    navigate('/dashboard')
  }

  return (
    <label className="view-as">
      <span>View as</span>
      <select value={viewingAs?.id ?? ''} onChange={(event) => choose(event.target.value)}>
        <option value="">Admin (everything)</option>
        {groups.map(({ role, label }) => {
          const members = people.filter((person) => person.role === role)
          return members.length ? (
            <optgroup key={role} label={label}>
              {members.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email}</option>)}
            </optgroup>
          ) : null
        })}
      </select>
    </label>
  )
}

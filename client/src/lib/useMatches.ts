import { useEffect, useState } from 'react'
import { supabase, type Role } from './supabase'

export type MatchPerson = { id: string; full_name: string | null } | null

export type MatchRecord = {
  id: string
  student_id: string
  mentor_id: string
  company_id: string | null
  status: 'proposed' | 'active' | 'completed' | 'cancelled'
  created_at: string
  student: MatchPerson
  mentor: MatchPerson
  company: MatchPerson
}

export function useMatches(role: Role | undefined, userId: string | undefined) {
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      if (!userId || !role || role === 'admin') {
        setMatches([])
        setLoading(false)
        return
      }
      let query = supabase.from('matches')
        .select('id, student_id, mentor_id, company_id, status, created_at, student:student_id(id, full_name), mentor:mentor_id(id, full_name), company:company_id(id, full_name)')
        .order('created_at', { ascending: false })
      if (role === 'student') query = query.eq('student_id', userId)
      else if (role === 'mentor') query = query.eq('mentor_id', userId)
      else query = query.eq('company_id', userId)
      const { data, error: queryError } = await query
      if (!active) return
      if (queryError) setError(queryError.message)
      setMatches((data ?? []) as unknown as MatchRecord[])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [role, userId])

  return { matches, loading, error }
}
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { PlatformSession } from './platform'
import type { MatchRecord } from './useMatches'

export function useSessions(matches: MatchRecord[]) {
  const [sessions, setSessions] = useState<PlatformSession[]>([])
  const [loading, setLoading] = useState(true)
  const matchIds = matches.map(({ id }) => id).sort().join(',')

  useEffect(() => {
    let active = true
    const ids = matchIds ? matchIds.split(',') : []
    async function load() {
      if (!ids.length) {
        setSessions([])
        setLoading(false)
        return
      }
      const { data } = await supabase.from('sessions')
        .select('id, match_id, title, starts_at, duration_min, meeting_url, notes')
        .in('match_id', ids)
        .order('starts_at')
      if (active) {
        setSessions((data ?? []) as PlatformSession[])
        setLoading(false)
      }
    }
    void load()
    const channels = ids.map((matchId) => supabase.channel(`sessions:${matchId}`).on(
      'postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `match_id=eq.${matchId}` },
      () => { void load() },
    ).subscribe())
    return () => {
      active = false
      channels.forEach((channel) => { void supabase.removeChannel(channel) })
    }
  }, [matchIds])

  return { sessions, loading }
}
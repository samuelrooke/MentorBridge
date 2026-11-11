import { useEffect, useState } from 'react'
import { countUnreadMessages, type PlatformMessage } from './platform'
import { supabase } from './supabase'
import type { MatchRecord } from './useMatches'

export function useUnreadCounts(matches: MatchRecord[], userId: string | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const matchIds = matches.map(({ id }) => id).sort().join(',')

  useEffect(() => {
    let active = true
    const ids = matchIds ? matchIds.split(',') : []
    async function load() {
      if (!userId || !ids.length) {
        setCounts({})
        return
      }
      const [messageResult, readResult] = await Promise.all([
        supabase.from('messages').select('id, match_id, sender_id, body, created_at').in('match_id', ids),
        supabase.from('message_reads').select('match_id, read_at').eq('user_id', userId).in('match_id', ids),
      ])
      if (!active) return
      const reads = new Map((readResult.data ?? []).map((read) => [read.match_id, read.read_at]))
      const next: Record<string, number> = {}
      for (const matchId of ids) {
        const messages = (messageResult.data ?? []).filter((message) => message.match_id === matchId)
        next[matchId] = countUnreadMessages(messages as PlatformMessage[], userId, reads.get(matchId) ?? null)
      }
      setCounts(next)
    }
    void load()
    const channel = supabase.channel(`unread:${userId ?? 'none'}:${matchIds}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads', filter: userId ? `user_id=eq.${userId}` : undefined }, () => { void load() })
      .subscribe()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [matchIds, userId])

  return counts
}
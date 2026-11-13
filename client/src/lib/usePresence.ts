import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

export type MatchPresence = { online: string[]; typing: string[] }

// "Online now" and "typing…" per conversation, through Supabase Realtime presence.
// Nothing is stored: presence only exists while someone has the messages page open.
// Each person is tracked under their account id and shares only whether they're typing.
export function usePresence(matchIds: string[], actorId: string | undefined) {
  const [presence, setPresence] = useState<Record<string, MatchPresence>>({})
  const channels = useRef(new Map<string, RealtimeChannel>())
  const key = [...matchIds].sort().join(',')

  useEffect(() => {
    if (!actorId || !key) return
    const opened = key.split(',').map((matchId) => {
      const channel = supabase.channel(`presence:${matchId}`, { config: { presence: { key: actorId } } })
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<{ typing?: boolean }>()
          const online = Object.keys(state)
          const typing = online.filter((id) => state[id]?.some((entry) => entry.typing))
          setPresence((current) => ({ ...current, [matchId]: { online, typing } }))
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void channel.track({ typing: false })
        })
      channels.current.set(matchId, channel)
      return channel
    })
    const open = channels.current
    return () => {
      for (const channel of opened) void supabase.removeChannel(channel)
      open.clear()
    }
  }, [key, actorId])

  const setTyping = useCallback((matchId: string, typing: boolean) => {
    void channels.current.get(matchId)?.track({ typing })
  }, [])

  return { presence, setTyping }
}

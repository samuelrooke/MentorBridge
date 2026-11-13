import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/chat/ChatBits'
import Conversation, { type Person } from '../components/chat/Conversation'
import { useViewer } from '../context/viewer'
import { MESSAGE_COLUMNS, previewText, senderInfo, shortTime, type ChatMessage } from '../lib/messaging'
import { matchLabel } from '../lib/platform'
import { supabase } from '../lib/supabase'
import { useMatches } from '../lib/useMatches'
import { usePresence } from '../lib/usePresence'
import { useSignedUrls } from '../lib/useSignedUrls'

type Permission = NotificationPermission | 'unsupported'

export default function Messages() {
  // Shown from the viewer's side (the person an admin views as, or the user). Every write
  // uses the logged-in account (actorId), so an admin always posts as "MentorBridge team".
  const { viewer, actorId, isAdmin } = useViewer()
  const { matches, loading } = useMatches(viewer?.role, viewer?.id)
  const { unreadCounts } = useOutletContext<{ unreadCounts: Record<string, number> }>()
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('match'))
  const [previews, setPreviews] = useState<Record<string, ChatMessage>>({})
  const [people, setPeople] = useState<Map<string, Person>>(new Map())
  const [filter, setFilter] = useState('')
  const [permission, setPermission] = useState<Permission>(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const selectedRef = useRef(selectedId)
  const { presence, setTyping } = usePresence(matches.map((m) => m.id), actorId)

  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  const matchKey = matches.map((m) => m.id).join(',')

  // Names, roles and photos of everyone in these conversations.
  useEffect(() => {
    const ids = [...new Set(matches.flatMap((m) => [m.student_id, m.mentor_id]))]
    if (!ids.length) return
    let active = true
    void supabase.from('profiles').select('id, full_name, avatar_path, role').in('id', ids)
      .then(({ data }) => { if (active) setPeople(new Map(((data ?? []) as Person[]).map((p) => [p.id, p]))) })
    return () => { active = false }
  }, [matches])
  const avatarByPath = useSignedUrls('avatars', [...people.values()].map((p) => p.avatar_path))
  const avatarUrls = useMemo(() => Object.fromEntries([...people.values()].flatMap((p) => (p.avatar_path && avatarByPath[p.avatar_path] ? [[p.id, avatarByPath[p.avatar_path]]] : []))), [people, avatarByPath])

  // The newest message of each conversation, for the list.
  useEffect(() => {
    const ids = matchKey ? matchKey.split(',') : []
    if (!ids.length) return
    let active = true
    void Promise.all(ids.map((id) => supabase.from('messages').select(MESSAGE_COLUMNS).eq('match_id', id).order('created_at', { ascending: false }).limit(1)))
      .then((results) => {
        if (!active) return
        const latest: Record<string, ChatMessage> = {}
        results.forEach(({ data }, index) => { if (data?.[0]) latest[ids[index]] = data[0] as ChatMessage })
        setPreviews(latest)
      })
    return () => { active = false }
  }, [matchKey])

  const updatePreview = useCallback((row: ChatMessage) => {
    setPreviews((current) => {
      const existing = current[row.match_id]
      if (existing && existing.id !== row.id && existing.created_at > row.created_at) return current
      return { ...current, [row.match_id]: row }
    })
  }, [])

  // New messages in any conversation: update the list and, if allowed, show a desktop notification.
  useEffect(() => {
    if (!actorId || !matchKey) return
    const ids = new Set(matchKey.split(','))
    const channel = supabase.channel(`inbox:${actorId}:${viewer?.id ?? ''}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as ChatMessage
        if (!ids.has(row.match_id)) return
        updatePreview(row)
        const fromSomeoneElse = row.sender_id !== actorId
        const elsewhere = document.visibilityState !== 'visible' || selectedRef.current !== row.match_id
        if (fromSomeoneElse && elsewhere && 'Notification' in window && Notification.permission === 'granted') {
          const match = matches.find((m) => m.id === row.match_id)
          const sender = match ? senderInfo(match, row.sender_id, viewer?.id) : null
          const name = sender?.kind === 'team' ? 'MentorBridge team' : people.get(row.sender_id)?.full_name ?? 'New message'
          const notification = new Notification(`${name} · MentorBridge`, { body: row.body || 'Sent a picture', tag: row.match_id })
          notification.onclick = () => { window.focus(); setSelectedId(row.match_id) }
        }
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [actorId, matchKey, matches, people, updatePreview, viewer?.id])

  async function enableNotifications() {
    if (!('Notification' in window)) return
    setPermission(await Notification.requestPermission())
  }

  const sorted = useMemo(() => [...matches].sort((a, b) => {
    const at = previews[a.id]?.created_at ?? a.created_at
    const bt = previews[b.id]?.created_at ?? b.created_at
    return bt.localeCompare(at)
  }), [matches, previews])

  const nameOf = (id: string) => people.get(id)?.full_name ?? ''
  const labelFor = (match: (typeof matches)[number]) => {
    const others = [match.student_id, match.mentor_id].filter((id) => id !== viewer?.id)
    return others.length === 1 ? nameOf(others[0]) || matchLabel(match, viewer?.role) : matchLabel(match, viewer?.role)
  }
  const visible = sorted.filter((m) => !filter.trim() || labelFor(m).toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()))
  const selected = matches.find((m) => m.id === selectedId) ?? null

  if (loading) return <p className="muted">Loading conversations…</p>

  return (
    <div className={`messages-page${selected ? ' conversation-open' : ''}`}>
      <aside className="conversation-list" aria-label="Conversations">
        <div className="conversation-list-heading">
          <p className="eyebrow">{viewer?.role === 'admin' ? 'All conversations' : 'Your conversations'}</p>
          <h1>Messages</h1>
          {matches.length > 2 && (
            <input type="search" className="conversation-filter" placeholder="Find a conversation" aria-label="Find a conversation" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          {permission === 'default' && (
            <button className="text-link notify-link" onClick={() => void enableNotifications()}>Get a notification for new messages</button>
          )}
        </div>
        {visible.length ? visible.map((match) => {
          const others = [match.student_id, match.mentor_id].filter((id) => id !== viewer?.id)
          const single = others.length === 1 ? others[0] : null
          const state = presence[match.id]
          const online = (state?.online ?? []).some((id) => others.includes(id))
          const typing = (state?.typing ?? []).filter((id) => id !== actorId)
          const preview = previews[match.id]
          const unread = unreadCounts[match.id] ?? 0
          const label = labelFor(match)
          return (
            <button key={match.id} className={`conversation-link${selectedId === match.id ? ' selected' : ''}${unread ? ' has-unread' : ''}`} aria-current={selectedId === match.id ? 'true' : undefined} onClick={() => setSelectedId(match.id)}>
              <Avatar name={label} url={single ? avatarUrls[single] : undefined} online={online} />
              <span className="conversation-copy">
                <span className="conversation-line">
                  <strong>{label}</strong>
                  {preview && <span className="conversation-time">{shortTime(preview.created_at)}</span>}
                </span>
                <span className="conversation-role">
                  {single ? senderInfo(match, single, viewer?.id).roleLabel : 'Student and mentor'}{match.status !== 'active' ? ` · ${match.status}` : ''}
                </span>
                <span className={`conversation-preview${typing.length ? ' typing-text' : ''}`}>
                  {typing.length ? 'typing…' : previewText(preview, match, viewer?.id)}
                </span>
              </span>
              {unread > 0 && <span className="unread-badge" aria-label={`${unread} unread messages`}>{unread}</span>}
            </button>
          )
        }) : (
          <div className="conversation-empty">
            <strong>{matches.length ? 'No conversation found' : 'No conversations yet'}</strong>
            <p>{matches.length ? 'Try another name.' : 'Your conversation opens here as soon as you are matched.'}</p>
          </div>
        )}
      </aside>

      {selected && viewer && actorId ? (
        <Conversation
          key={selected.id}
          match={selected}
          viewerId={viewer.id}
          actorId={actorId}
          isAdmin={isAdmin}
          people={people}
          avatarUrls={avatarUrls}
          presence={presence[selected.id]}
          setTyping={(typing) => setTyping(selected.id, typing)}
          onBack={() => setSelectedId(null)}
          onActivity={updatePreview}
        />
      ) : (
        <section className="conversation-panel" aria-label="Conversation">
          <div className="conversation-placeholder">
            <span className="empty-chat-mark" aria-hidden="true">M</span>
            <h2>{matches.length ? 'Choose a conversation' : 'No conversation yet'}</h2>
            <p className="muted">{matches.length ? 'Pick someone on the left to read and send messages.' : 'Your private chat will be ready when you have a match.'}</p>
          </div>
        </section>
      )}
    </div>
  )
}

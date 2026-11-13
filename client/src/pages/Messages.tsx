import { friendlyError } from '../lib/errors'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useViewer } from '../context/viewer'
import { groupMessagesByDay, isTeamMessage, matchLabel, type PlatformMessage } from '../lib/platform'
import { supabase } from '../lib/supabase'
import { useMatches } from '../lib/useMatches'

type MessageRow = PlatformMessage & { match_id: string }

export default function Messages() {
  // The conversation is shown from the viewer's side (the person an admin views as, or the
  // admin). Sending and read markers always use the logged-in account (actorId), so an admin
  // posts as "MentorBridge team" and never changes someone else's unread state.
  const { viewer: profile, actorId, isAdmin } = useViewer()
  const { matches, loading: matchesLoading } = useMatches(profile?.role, profile?.id)
  const { unreadCounts } = useOutletContext<{ unreadCounts: Record<string, number> }>()
  const [searchParams] = useSearchParams()
  // ?match=<id> opens that conversation straight away (used by the admin dashboard).
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(() => searchParams.get('match'))
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [previews, setPreviews] = useState<Record<string, MessageRow>>({})
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const userId = profile?.id
  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null

  useEffect(() => {
    let active = true
    async function loadPreviews() {
      if (!matches.length) {
        setPreviews({})
        return
      }
      const { data } = await supabase.from('messages').select('id, match_id, sender_id, body, created_at')
        .in('match_id', matches.map(({ id }) => id)).order('created_at', { ascending: false })
      if (!active) return
      const latest: Record<string, MessageRow> = {}
      for (const row of data ?? []) if (!latest[row.match_id]) latest[row.match_id] = row as MessageRow
      setPreviews(latest)
    }
    void loadPreviews()
    const channel = supabase.channel(`message-previews:${userId ?? 'none'}`).on(
      'postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const row = payload.new as MessageRow
        if (matches.some((match) => match.id === row.match_id)) setPreviews((current) => ({ ...current, [row.match_id]: row }))
      },
    ).subscribe()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [matches, userId])

  useEffect(() => {
    if (!selectedMatchId || !userId || !actorId) {
      return
    }
    let active = true
    const matchId = selectedMatchId
    async function markRead() {
      await supabase.from('message_reads').upsert(
        { match_id: matchId, user_id: actorId, read_at: new Date().toISOString() },
        { onConflict: 'match_id,user_id' },
      )
    }
    async function loadMessages() {
      setLoading(true)
      setError(null)
      const { data, error: loadError } = await supabase.from('messages')
        .select('id, match_id, sender_id, body, created_at').eq('match_id', matchId)
        .order('created_at', { ascending: false }).limit(50)
      if (!active) return
      if (loadError) setError(friendlyError(loadError))
      const rows = (data ?? []).reverse() as MessageRow[]
      setMessages(rows)
      setHasOlder(rows.length === 50)
      setLoading(false)
      await markRead()
    }
    void loadMessages()
    const channel = supabase.channel(`messages:${matchId}`).on(
      'postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
      (payload) => {
        const row = payload.new as MessageRow
        setMessages((current) => current.some((message) => message.id === row.id) ? current : [...current, row])
        setPreviews((current) => ({ ...current, [matchId]: row }))
        void markRead()
      },
    ).subscribe()
    return () => {
      active = false
      void supabase.removeChannel(channel)
    }
  }, [selectedMatchId, userId, actorId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  async function loadOlder() {
    const oldest = messages[0]
    if (!selectedMatchId || !oldest) return
    setLoadingOlder(true)
    const { data, error: olderError } = await supabase.from('messages')
      .select('id, match_id, sender_id, body, created_at').eq('match_id', selectedMatchId)
      .lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(50)
    if (olderError) setError(friendlyError(olderError))
    const rows = (data ?? []).reverse() as MessageRow[]
    setMessages((current) => [...rows, ...current])
    setHasOlder(rows.length === 50)
    setLoadingOlder(false)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanBody = body.trim()
    if (!selectedMatchId || !actorId || !cleanBody || cleanBody.length > 5000) return
    setSending(true)
    setError(null)
    const { error: sendError } = await supabase.from('messages').insert({ match_id: selectedMatchId, sender_id: actorId, body: cleanBody })
    setSending(false)
    if (sendError) setError(friendlyError(sendError))
    else setBody('')
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  if (matchesLoading) return <p className="muted">Loading conversations...</p>

  return (
    <div className={`messages-page${selectedMatchId ? ' conversation-open' : ''}`}>
      <aside className="conversation-list" aria-label="Conversations">
        <div className="conversation-list-heading"><p className="eyebrow">{profile?.role === 'admin' ? 'All conversations' : 'Your workspace'}</p><h1>Messages</h1></div>
        {matches.length ? matches.map((match) => {
          const other = { full_name: matchLabel(match, profile?.role) }
          const preview = previews[match.id]
          const unread = unreadCounts[match.id] ?? 0
          return <button key={match.id} className={`conversation-link${selectedMatchId === match.id ? ' selected' : ''}`} aria-current={selectedMatchId === match.id ? 'true' : undefined} onClick={() => { setMessages([]); setSelectedMatchId(match.id) }}>
            <span className="conversation-avatar" aria-hidden="true">{(other?.full_name ?? '?').slice(0, 1).toUpperCase()}</span>
            <span className="conversation-copy"><strong>{other?.full_name ?? 'Your match'}</strong><span>{preview?.body ?? 'No messages yet'}</span></span>
            {unread > 0 && <span className="unread-badge" aria-label={`${unread} unread messages`}>{unread}</span>}
          </button>
        }) : <div className="conversation-empty"><strong>No people yet</strong><p>Your conversations will appear here after you are matched.</p></div>}
      </aside>
      <section className="conversation-panel" aria-label="Conversation">
        {!selectedMatch ? <div className="conversation-placeholder"><span className="empty-chat-mark" aria-hidden="true">M</span><h2>{matches.length ? 'Choose a conversation' : 'No conversation yet'}</h2><p className="muted">{matches.length ? 'Select a match to read and send messages.' : 'Your private chat will be ready when you have a match.'}</p></div> : <>
          <header className="conversation-header"><button className="back-to-conversations" onClick={() => { setMessages([]); setSelectedMatchId(null) }}>Back</button><div><p className="eyebrow">Conversation with</p><h2>{matchLabel(selectedMatch, profile?.role)}</h2></div></header>
          <div className="message-history" aria-live="polite">
            {hasOlder && <button className="load-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? 'Loading...' : 'Load older messages'}</button>}
            {loading ? <p className="muted centered">Loading messages...</p> : messages.length ? groupMessagesByDay(messages).map((group) => <section className="message-day" key={group.label}>
              <h3>{group.label}</h3>
              {group.messages.map((message) => <article key={message.id} className={`message-row${message.sender_id === userId ? ' own-message' : ''}${isTeamMessage(message, selectedMatch) ? ' team-message' : ''}`}><div className="message-bubble">{isTeamMessage(message, selectedMatch) && <span className="team-label">MentorBridge team</span>}<p>{message.body}</p><time dateTime={message.created_at}>{new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(message.created_at))}</time></div></article>)}
            </section>) : <div className="conversation-placeholder"><h2>Start the conversation</h2><p className="muted">Only the student, the mentor and the MentorBridge team can read these messages.</p></div>}
            <div ref={endRef} />
          </div>
          {error && <p className="alert alert-error message-error" role="alert">{error}</p>}
          {isAdmin && <p className="composer-note">You post as <strong>MentorBridge team</strong>. Both people in this match see your message.</p>}
          <form className="message-composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="message-body">Write a message</label><textarea id="message-body" rows={2} maxLength={5000} placeholder="Write a message..." value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={onComposerKeyDown} /><div className="composer-footer">{body.length >= 4500 && <span className="character-count">{body.length}/5000</span>}<button className="btn btn-primary btn-sm" disabled={!body.trim() || sending}>{sending ? 'Sending...' : 'Send'}</button></div></form>
        </>}
      </section>
    </div>
  )
}

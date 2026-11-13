import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { api } from '../../lib/api'
import { friendlyError } from '../../lib/errors'
import {
  MESSAGE_COLUMNS, PAGE_SIZE, REACTIONS, canChange, dayLabel, escapeLike, firstUnreadIndex, groupByDay, groupRuns, imageProblem,
  linkParts, seenState, senderInfo, shortTime, summarizeReactions, type ChatMessage, type Reaction,
} from '../../lib/messaging'
import { supabase } from '../../lib/supabase'
import type { MatchRecord } from '../../lib/useMatches'
import type { MatchPresence } from '../../lib/usePresence'
import { useSignedUrls } from '../../lib/useSignedUrls'
import { Avatar, Lightbox, ReportDialog, type ReportTarget } from './ChatBits'

export type Person = { id: string; full_name: string | null; avatar_path: string | null; role: string }

type Props = {
  match: MatchRecord
  /** Whose side the chat is shown from (the person an admin views as, or the user). */
  viewerId: string
  /** The logged-in account; every write uses it. */
  actorId: string
  isAdmin: boolean
  people: Map<string, Person>
  avatarUrls: Record<string, string>
  presence?: MatchPresence
  setTyping: (typing: boolean) => void
  onBack: () => void
  onActivity: (message: ChatMessage) => void
}

type Draft = { text: string; image: File | null; replyTo: ChatMessage | null }

const NEAR_BOTTOM_PX = 120

export default function Conversation({ match, viewerId, actorId, isAdmin, people, avatarUrls, presence, setTyping, onBack, onActivity }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [unreadAnchor, setUnreadAnchor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [text, setText] = useState('')
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editing, setEditing] = useState<ChatMessage | null>(null)
  const [dragging, setDragging] = useState(false)

  const [atBottom, setAtBottom] = useState(true)
  const [missed, setMissed] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [reactingTo, setReactingTo] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null)
  const [report, setReport] = useState<ReportTarget | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const historyRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stickToBottom = useRef(true)
  const restoreScroll = useRef<{ height: number; top: number } | null>(null)
  const initialScrollDone = useRef(false)
  const typingTimer = useRef<number | undefined>(undefined)
  const failedDrafts = useRef(new Map<string, Draft>())
  const lastMarked = useRef('')

  const otherIds = [match.student_id, match.mentor_id].filter((id) => id !== actorId && id !== viewerId)
  const nameOf = useCallback((id: string) => {
    const info = senderInfo(match, id, viewerId)
    if (info.kind === 'team') return 'MentorBridge team'
    return people.get(id)?.full_name || (info.kind === 'student' ? 'Student' : info.kind === 'mentor' ? 'Mentor' : 'You')
  }, [match, people, viewerId])
  const attachmentUrls = useSignedUrls('message-attachments', messages.map((m) => m.attachment_path))

  // Times like "edited" and the 1-hour window depend on the clock.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  // ---- First load: last messages, reactions, read markers ----
  useEffect(() => {
    let active = true
    void Promise.all([
      supabase.from('messages').select(MESSAGE_COLUMNS).eq('match_id', match.id).order('created_at', { ascending: false }).limit(PAGE_SIZE),
      supabase.from('message_reactions').select('message_id, user_id, emoji').eq('match_id', match.id),
      supabase.from('message_reads').select('user_id, read_at').eq('match_id', match.id),
    ]).then(([messageResult, reactionResult, readResult]) => {
      if (!active) return
      if (messageResult.error) setError(friendlyError(messageResult.error))
      const rows = ((messageResult.data ?? []) as ChatMessage[]).reverse()
      const markers = Object.fromEntries((readResult.data ?? []).map((r) => [r.user_id, r.read_at]))
      const firstUnread = firstUnreadIndex(rows, viewerId, markers[viewerId])
      setMessages(rows)
      setHasOlder(rows.length === PAGE_SIZE)
      setReactions((reactionResult.data ?? []) as Reaction[])
      setReadMarkers(markers)
      setUnreadAnchor(firstUnread >= 0 ? rows[firstUnread].id : null)
      setLoading(false)
    })
    return () => { active = false }
  }, [match.id, viewerId])

  // ---- Live updates ----
  useEffect(() => {
    const filter = `match_id=eq.${match.id}`
    const channel = supabase.channel(`chat:${match.id}:${actorId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (payload) => {
        const row = payload.new as ChatMessage
        setMessages((current) => (current.some((m) => m.id === row.id) ? current : [...current, row]))
        if (row.sender_id !== actorId && !stickToBottom.current) setMissed((count) => count + 1)
        onActivity(row)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (payload) => {
        const row = payload.new as ChatMessage
        setMessages((current) => current.map((m) => (m.id === row.id ? { ...m, ...row } : m)))
        if (row.deleted_at) setReactions((current) => current.filter((r) => r.message_id !== row.id))
        onActivity(row)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions', filter }, (payload) => {
        const row = payload.new as Reaction
        setReactions((current) => (current.some((r) => r.message_id === row.message_id && r.user_id === row.user_id && r.emoji === row.emoji) ? current : [...current, row]))
      })
      // Delete events can't be filtered by conversation; they only carry the key, which is enough.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const old = payload.old as Partial<Reaction>
        setReactions((current) => current.filter((r) => !(r.message_id === old.message_id && r.user_id === old.user_id && r.emoji === old.emoji)))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads', filter }, (payload) => {
        const row = payload.new as { user_id?: string; read_at?: string }
        if (row.user_id && row.read_at) setReadMarkers((current) => ({ ...current, [row.user_id!]: row.read_at! }))
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [match.id, actorId, onActivity])

  // ---- Read marker: when the newest message is on screen and the tab is visible ----
  useEffect(() => {
    const newest = messages.findLast((m) => !m.pending && !m.failed)
    if (!newest || !atBottom || document.visibilityState !== 'visible' || lastMarked.current >= newest.created_at) return
    lastMarked.current = newest.created_at
    void supabase.from('message_reads').upsert({ match_id: match.id, user_id: actorId, read_at: new Date().toISOString() }, { onConflict: 'match_id,user_id' })
  }, [messages, atBottom, match.id, actorId])

  // ---- Scrolling: first position, keep place when loading older, follow new messages ----
  useLayoutEffect(() => {
    const el = historyRef.current
    if (!el || loading) return
    if (restoreScroll.current) {
      el.scrollTop = el.scrollHeight - restoreScroll.current.height + restoreScroll.current.top
      restoreScroll.current = null
      return
    }
    if (!initialScrollDone.current) {
      initialScrollDone.current = true
      const anchor = unreadAnchor ? document.getElementById(`msg-${unreadAnchor}`) : null
      if (anchor) anchor.scrollIntoView({ block: 'center' })
      else el.scrollTop = el.scrollHeight
      return
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, loading, unreadAnchor])

  function onScroll() {
    const el = historyRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
    stickToBottom.current = near
    if (near !== atBottom) setAtBottom(near)
    if (near && missed) setMissed(0)
  }

  function scrollToBottom() {
    const el = historyRef.current
    if (!el) return
    stickToBottom.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    setMissed(0)
  }

  const loadOlder = useCallback(async () => {
    const oldest = messages.find((m) => !m.pending && !m.failed)
    const el = historyRef.current
    if (!oldest || !el || loadingOlder) return
    setLoadingOlder(true)
    const { data, error: olderError } = await supabase.from('messages').select(MESSAGE_COLUMNS).eq('match_id', match.id)
      .lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE_SIZE)
    if (olderError) setError(friendlyError(olderError))
    const rows = ((data ?? []) as ChatMessage[]).reverse()
    restoreScroll.current = { height: el.scrollHeight, top: el.scrollTop }
    setMessages((current) => [...rows, ...current])
    setHasOlder(rows.length === PAGE_SIZE)
    setLoadingOlder(false)
  }, [messages, loadingOlder, match.id])

  // Older messages load by themselves when you scroll to the top.
  useEffect(() => {
    const sentinel = topRef.current
    const root = historyRef.current
    if (!sentinel || !root || !hasOlder || loading) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadOlder()
    }, { root, rootMargin: '200px 0px 0px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasOlder, loading, loadOlder])

  // ---- Typing indicator ----
  function onTextChange(value: string) {
    setText(value)
    setTyping(Boolean(value.trim()))
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => setTyping(false), 3000)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 220)}px`
    }
  }
  useEffect(() => () => {
    window.clearTimeout(typingTimer.current)
    setTyping(false)
  }, [setTyping])

  // ---- Pictures: pick, paste or drop ----
  function chooseImage(file: File | undefined) {
    if (!file) return
    const problem = imageProblem(file)
    if (problem) return setError(problem)
    setError(null)
    if (image) URL.revokeObjectURL(image.url)
    setImage({ file, url: URL.createObjectURL(file) })
    textareaRef.current?.focus()
  }
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = [...event.clipboardData.files].find((f) => f.type.startsWith('image/'))
    if (file) {
      event.preventDefault()
      chooseImage(file)
    }
  }
  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    chooseImage([...event.dataTransfer.files].find((f) => f.type.startsWith('image/')))
  }

  // ---- Sending ----
  async function deliver(tempId: string, draft: Draft) {
    try {
      let attachment_path: string | null = null
      let attachment_type: string | null = null
      if (draft.image) {
        const extension = { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[draft.image.type] ?? 'jpg'
        attachment_path = `${match.id}/${crypto.randomUUID()}.${extension}`
        attachment_type = draft.image.type
        const upload = await supabase.storage.from('message-attachments').upload(attachment_path, draft.image, { contentType: draft.image.type })
        if (upload.error) throw upload.error
      }
      const { data, error: sendError } = await supabase.from('messages')
        .insert({ match_id: match.id, sender_id: actorId, body: draft.text, attachment_path, attachment_type, reply_to_id: draft.replyTo?.id ?? null })
        .select(MESSAGE_COLUMNS).single()
      if (sendError) throw sendError
      const row = data as ChatMessage
      failedDrafts.current.delete(tempId)
      setMessages((current) => {
        const temp = current.find((m) => m.id === tempId)
        if (temp?.localImageUrl) URL.revokeObjectURL(temp.localImageUrl)
        const rest = current.filter((m) => m.id !== tempId)
        return rest.some((m) => m.id === row.id) ? rest : [...rest, row]
      })
      onActivity(row)
    } catch (sendError) {
      failedDrafts.current.set(tempId, draft)
      setMessages((current) => current.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)))
      setError(friendlyError(sendError))
    }
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    const body = text.trim()
    if (body.length > 5000) return setError('A message can be at most 5,000 characters.')
    if (editing) {
      try {
        await api(`/messages/${editing.id}/edit`, { method: 'POST', body: JSON.stringify({ body }) })
        setEditing(null)
        onTextChange('')
      } catch (editError) {
        setError((editError as Error).message)
      }
      return
    }
    if (!body && !image) return
    const tempId = `temp-${crypto.randomUUID()}`
    const draft: Draft = { text: body, image: image?.file ?? null, replyTo }
    setMessages((current) => [...current, {
      id: tempId, match_id: match.id, sender_id: actorId, body, created_at: new Date().toISOString(),
      attachment_path: null, attachment_type: image?.file.type ?? null, deleted_at: null, deleted_by: null,
      reply_to_id: replyTo?.id ?? null, edited_at: null, pending: true, localImageUrl: image?.url,
    }])
    stickToBottom.current = true
    setImage(null)
    setReplyTo(null)
    setError(null)
    onTextChange('')
    setTyping(false)
    await deliver(tempId, draft)
  }

  function retry(message: ChatMessage) {
    const draft = failedDrafts.current.get(message.id)
    if (!draft) return
    setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, failed: false, pending: true } : m)))
    void deliver(message.id, draft)
  }

  function discard(message: ChatMessage) {
    failedDrafts.current.delete(message.id)
    if (message.localImageUrl) URL.revokeObjectURL(message.localImageUrl)
    setMessages((current) => current.filter((m) => m.id !== message.id))
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape') {
      if (editing) { setEditing(null); onTextChange('') } else if (replyTo) setReplyTo(null)
    } else if (event.key === 'ArrowUp' && !text) {
      // Like most messengers: arrow up in an empty box edits your last message.
      const last = messages.findLast((m) => canChange(m, actorId, now) && m.body)
      if (last) startEdit(last)
    }
  }

  // ---- Message actions ----
  function startReply(message: ChatMessage) {
    setEditing(null)
    setReplyTo(message)
    setOpenActions(null)
    textareaRef.current?.focus()
  }
  function startEdit(message: ChatMessage) {
    setReplyTo(null)
    setEditing(message)
    setOpenActions(null)
    onTextChange(message.body)
    textareaRef.current?.focus()
  }
  async function remove(message: ChatMessage) {
    setOpenActions(null)
    const asAdmin = message.sender_id !== actorId
    const question = asAdmin
      ? `Delete this message from ${nameOf(message.sender_id)} for everyone? It’s shown as “Deleted by the MentorBridge team”.`
      : 'Delete this message for everyone?'
    if (!window.confirm(question)) return
    try {
      if (asAdmin) await api(`/admin/messages/${message.id}`, { method: 'DELETE' })
      else await api(`/messages/${message.id}/unsend`, { method: 'POST' })
    } catch (deleteError) {
      setError((deleteError as Error).message)
    }
  }
  async function toggleReaction(message: ChatMessage, emoji: string) {
    setReactingTo(null)
    setOpenActions(null)
    const mine = reactions.some((r) => r.message_id === message.id && r.user_id === actorId && r.emoji === emoji)
    if (mine) {
      setReactions((current) => current.filter((r) => !(r.message_id === message.id && r.user_id === actorId && r.emoji === emoji)))
      const { error: reactionError } = await supabase.from('message_reactions').delete().match({ message_id: message.id, user_id: actorId, emoji })
      if (reactionError) setError(friendlyError(reactionError))
    } else {
      setReactions((current) => [...current, { message_id: message.id, user_id: actorId, emoji }])
      const { error: reactionError } = await supabase.from('message_reactions').insert({ message_id: message.id, user_id: actorId, match_id: match.id, emoji })
      if (reactionError) setError(friendlyError(reactionError))
    }
  }
  function copyText(message: ChatMessage) {
    setOpenActions(null)
    void navigator.clipboard?.writeText(message.body)
  }

  // ---- Search ----
  async function runSearch(event: FormEvent) {
    event.preventDefault()
    const term = searchTerm.trim()
    if (!term) return setSearchResults(null)
    const { data, error: searchError } = await supabase.from('messages').select(MESSAGE_COLUMNS).eq('match_id', match.id)
      .is('deleted_at', null).ilike('body', `%${escapeLike(term)}%`).order('created_at', { ascending: false }).limit(30)
    if (searchError) setError(friendlyError(searchError))
    setSearchResults((data ?? []) as ChatMessage[])
  }

  async function jumpTo(target: ChatMessage) {
    setSearchResults(null)
    setSearchOpen(false)
    if (!messages.some((m) => m.id === target.id)) {
      const oldest = messages.find((m) => !m.pending && !m.failed)
      const { data } = await supabase.from('messages').select(MESSAGE_COLUMNS).eq('match_id', match.id)
        .gte('created_at', target.created_at).lt('created_at', oldest?.created_at ?? new Date().toISOString())
        .order('created_at', { ascending: true }).limit(1000)
      const rows = (data ?? []) as ChatMessage[]
      setMessages((current) => [...rows.filter((r) => !current.some((m) => m.id === r.id)), ...current])
      setHasOlder(true)
    }
    stickToBottom.current = false
    setHighlightId(target.id)
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`msg-${target.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })))
    window.setTimeout(() => setHighlightId(null), 2500)
  }

  // ---- Derived ----
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const seen = seenState(messages, actorId, otherIds.map((id) => readMarkers[id]))
  const typingNames = (presence?.typing ?? []).filter((id) => id !== actorId).map(nameOf)
  const onlineOthers = (presence?.online ?? []).filter((id) => otherIds.includes(id))
  const headerPeople = [match.student_id, match.mentor_id].filter((id) => id !== viewerId)
  const title = headerPeople.map(nameOf).join(' and ')
  const subtitle = typingNames.length
    ? `${typingNames.join(' and ')} ${typingNames.length > 1 ? 'are' : 'is'} typing…`
    : headerPeople.length === 1
      ? `${senderInfo(match, headerPeople[0], viewerId).roleLabel} · ${onlineOthers.length ? 'Online now' : `Matched ${dayLabel(match.created_at)}`}`
      : `Student and mentor · ${onlineOthers.length ? `${onlineOthers.map(nameOf).join(' and ')} online` : `matched ${dayLabel(match.created_at)}`}`
  const reportablePerson = !isAdmin && headerPeople.length === 1 ? headerPeople[0] : null

  return (
    <section className={`conversation-panel${dragging ? ' dragging' : ''}`} aria-label={`Conversation with ${title}`}
      onDragOver={(event) => { if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); setDragging(true) } }}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }}
      onDrop={onDrop}>
      <header className="conversation-header">
        <button className="back-to-conversations" onClick={onBack} aria-label="Back to conversations">‹</button>
        <Avatar name={title} url={headerPeople.length === 1 ? avatarUrls[headerPeople[0]] : undefined} online={onlineOthers.length > 0} />
        <div className="conversation-title">
          <h2>{title}</h2>
          <p className={typingNames.length ? 'typing-text' : 'muted'}>{subtitle}</p>
        </div>
        <div className="conversation-tools">
          <button className="icon-button" aria-label="Search this conversation" aria-pressed={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setSearchResults(null) }}>⌕</button>
          {reportablePerson && (
            <button className="text-link danger-link" onClick={() => setReport({ matchId: match.id, personId: reportablePerson, personName: nameOf(reportablePerson) })}>Report</button>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className="chat-search">
          <form onSubmit={runSearch} className="chat-search-form">
            <label className="sr-only" htmlFor="chat-search">Search messages</label>
            <input id="chat-search" type="search" autoFocus placeholder="Search in this conversation" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
            <button className="btn btn-ghost btn-sm">Search</button>
          </form>
          {searchResults && (
            <ul className="chat-search-results">
              {searchResults.length ? searchResults.map((result) => (
                <li key={result.id}>
                  <button onClick={() => void jumpTo(result)}>
                    <strong>{nameOf(result.sender_id)}</strong><span className="muted"> · {shortTime(result.created_at)}</span>
                    <span className="search-snippet">{result.body}</span>
                  </button>
                </li>
              )) : <li className="muted">No messages found.</li>}
            </ul>
          )}
        </div>
      )}

      <div className="message-history" ref={historyRef} onScroll={onScroll} aria-live="polite" aria-relevant="additions">
        <div ref={topRef} className="history-top">
          {loadingOlder ? <span className="muted">Loading older messages…</span> : hasOlder ? <button className="load-older" onClick={() => void loadOlder()}>Load older messages</button> : !loading && messages.length > 0 && <span className="muted">This is the start of your conversation.</span>}
        </div>
        {loading ? <p className="muted centered">Loading messages…</p> : messages.length ? groupByDay(messages).map((day) => (
          <section className="message-day" key={day.key}>
            <h3>{day.label}</h3>
            {groupRuns(day.messages).map((run) => {
              const who = senderInfo(match, run.senderId, viewerId)
              const name = nameOf(run.senderId)
              return (
                <div key={run.messages[0].id} className={`message-run run-${who.kind}`}>
                  {who.kind !== 'you' && (
                    <div className="run-author">
                      <Avatar name={name} url={avatarUrls[run.senderId]} team={who.kind === 'team'} size="sm" online={(presence?.online ?? []).includes(run.senderId)} />
                      <strong>{name}</strong>
                      <span className={`role-tag role-${who.kind}`}>{who.roleLabel}</span>
                    </div>
                  )}
                  {who.kind === 'you' && isAdmin && viewerId === actorId && <div className="run-author run-author-own"><span className="role-tag role-team">You, as MentorBridge team</span></div>}
                  {run.messages.map((message) => (
                    <Fragment key={message.id}>
                      {message.id === unreadAnchor && <div className="unread-divider" role="separator"><span>New messages</span></div>}
                      <MessageItem
                        message={message}
                        own={who.kind === 'you'}
                        team={who.kind === 'team'}
                        authorName={name}
                        reply={message.reply_to_id ? byId.get(message.reply_to_id) ?? null : null}
                        replyAuthor={message.reply_to_id && byId.get(message.reply_to_id) ? nameOf(byId.get(message.reply_to_id)!.sender_id) : null}
                        imageUrl={message.localImageUrl ?? (message.attachment_path ? attachmentUrls[message.attachment_path] : undefined)}
                        reactions={summarizeReactions(reactions, message.id, actorId)}
                        seenLabel={seen?.messageId === message.id ? seen.label : null}
                        highlighted={highlightId === message.id}
                        actionsOpen={openActions === message.id}
                        reacting={reactingTo === message.id}
                        canEdit={canChange(message, actorId, now) && Boolean(message.body)}
                        canDelete={!message.deleted_at && !message.pending && !message.failed && (canChange(message, actorId, now) || isAdmin)}
                        canReport={!isAdmin && !message.deleted_at && (who.kind === 'student' || who.kind === 'mentor')}
                        deletedByTeam={Boolean(message.deleted_at && message.deleted_by && message.deleted_by !== message.sender_id)}
                        onToggleActions={() => setOpenActions(openActions === message.id ? null : message.id)}
                        onReact={(emoji) => void toggleReaction(message, emoji)}
                        onToggleReacting={() => setReactingTo(reactingTo === message.id ? null : message.id)}
                        onReply={() => startReply(message)}
                        onEdit={() => startEdit(message)}
                        onDelete={() => void remove(message)}
                        onCopy={() => copyText(message)}
                        onReport={() => setReport({ matchId: match.id, personId: message.sender_id, personName: name, messageId: message.id, messageText: message.body || 'Picture' })}
                        onOpenImage={(url) => setLightbox({ url, alt: `Picture from ${name}` })}
                        onJumpToReply={() => { const target = message.reply_to_id ? byId.get(message.reply_to_id) : null; if (target) void jumpTo(target) }}
                        onRetry={() => retry(message)}
                        onDiscard={() => discard(message)}
                        onImageLoad={() => { if (stickToBottom.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight }}
                      />
                    </Fragment>
                  ))}
                </div>
              )
            })}
          </section>
        )) : (
          <div className="conversation-placeholder">
            <Avatar name={title} url={headerPeople.length === 1 ? avatarUrls[headerPeople[0]] : undefined} size="lg" />
            <h2>Say hello to {title}</h2>
            <p className="muted">Only the student, the mentor and the MentorBridge team can read these messages.</p>
          </div>
        )}
        {typingNames.length > 0 && (
          <div className="typing-bubble" aria-label={`${typingNames.join(' and ')} typing`}><span /><span /><span /></div>
        )}
      </div>

      {!atBottom && (
        <button className="jump-latest" onClick={scrollToBottom}>{missed ? `${missed} new ${missed === 1 ? 'message' : 'messages'}` : 'Jump to latest'} ↓</button>
      )}

      {error && <p className="alert alert-error message-error" role="alert">{error} <button className="link-button" onClick={() => setError(null)}>Dismiss</button></p>}
      {isAdmin && <p className="composer-note">You post as <strong>MentorBridge team</strong>. Both people in this match see your messages.</p>}

      <form className="message-composer" onSubmit={submit}>
        {(replyTo || editing) && (
          <div className="composer-context">
            <span>{editing ? <>Editing your message</> : <>Replying to <strong>{nameOf(replyTo!.sender_id)}</strong>: {replyTo!.body || 'Picture'}</>}</span>
            <button type="button" className="icon-button" aria-label={editing ? 'Cancel editing' : 'Cancel reply'} onClick={() => { if (editing) { setEditing(null); onTextChange('') } else setReplyTo(null) }}>×</button>
          </div>
        )}
        {image && (
          <div className="composer-image">
            <img src={image.url} alt="Picture to send" />
            <button type="button" className="text-link danger-link" onClick={() => { URL.revokeObjectURL(image.url); setImage(null) }}>Remove picture</button>
          </div>
        )}
        <div className="composer-row">
          {!editing && (
            <>
              <button type="button" className="icon-button attach-button" aria-label="Add a picture" onClick={() => fileRef.current?.click()}>＋</button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { chooseImage(event.target.files?.[0]); event.target.value = '' }} />
            </>
          )}
          <label className="sr-only" htmlFor="message-body">Write a message</label>
          <textarea id="message-body" ref={textareaRef} rows={1} maxLength={5000} placeholder={image ? 'Add a caption…' : 'Write a message…'} value={text}
            onChange={(event) => onTextChange(event.target.value)} onKeyDown={onComposerKeyDown} onPaste={onPaste} />
          <button className="btn btn-primary btn-sm send-button" disabled={!text.trim() && !image}>{editing ? 'Save' : 'Send'}</button>
        </div>
        <div className="composer-footer">
          <span className="field-hint">Enter to send · Shift+Enter for a new line{!editing ? ' · paste or drop a picture' : ''}</span>
          {text.length >= 4500 && <span className="character-count">{text.length}/5000</span>}
        </div>
      </form>

      {lightbox && <Lightbox url={lightbox.url} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      {report && <ReportDialog target={report} onClose={() => setReport(null)} />}
    </section>
  )
}

// ---------------------------------------------------------------------------
// One message: quote, text or picture, reactions, time, and its actions.
// ---------------------------------------------------------------------------
type ItemProps = {
  message: ChatMessage
  own: boolean
  team: boolean
  authorName: string
  reply: ChatMessage | null
  replyAuthor: string | null
  imageUrl?: string
  reactions: { emoji: string; count: number; mine: boolean }[]
  seenLabel: 'Seen' | 'Sent' | null
  highlighted: boolean
  actionsOpen: boolean
  reacting: boolean
  canEdit: boolean
  canDelete: boolean
  canReport: boolean
  deletedByTeam: boolean
  onToggleActions: () => void
  onReact: (emoji: string) => void
  onToggleReacting: () => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onCopy: () => void
  onReport: () => void
  onOpenImage: (url: string) => void
  onJumpToReply: () => void
  onRetry: () => void
  onDiscard: () => void
  onImageLoad: () => void
}

function MessageItem(props: ItemProps) {
  const { message, own, team, imageUrl } = props
  const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(message.created_at))
  const fullTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(message.created_at))
  const deleted = Boolean(message.deleted_at)

  return (
    <article id={`msg-${message.id}`} className={`message-row${own ? ' own-message' : ''}${team ? ' team-message' : ''}${props.highlighted ? ' highlighted' : ''}${message.pending ? ' pending' : ''}`}>
      <div className="message-stack">
        <div className={`message-bubble${deleted ? ' deleted' : ''}${imageUrl && !message.body ? ' image-only' : ''}`}>
          {team && <span className="team-label">MentorBridge team</span>}
          {deleted ? (
            <p className="deleted-text">{props.deletedByTeam ? 'Deleted by the MentorBridge team' : 'Message deleted'}</p>
          ) : (
            <>
              {message.reply_to_id && (
                <button type="button" className="reply-quote" onClick={props.onJumpToReply}>
                  <strong>{props.replyAuthor ?? 'Earlier message'}</strong>
                  <span>{props.reply ? (props.reply.deleted_at ? 'Message deleted' : props.reply.body || 'Picture') : 'Tap to find the message'}</span>
                </button>
              )}
              {(imageUrl || message.attachment_type) && (
                imageUrl
                  ? <button type="button" className="message-image" onClick={() => props.onOpenImage(imageUrl)} aria-label={`Open picture from ${props.authorName}`}><img src={imageUrl} alt={`Picture from ${props.authorName}`} loading="lazy" onLoad={props.onImageLoad} /></button>
                  : <span className="image-placeholder" aria-label="Picture loading" />
              )}
              {message.body && <p>{linkParts(message.body).map((part, index) => (part.href ? <a key={index} href={part.href} target="_blank" rel="noreferrer noopener">{part.text}</a> : <Fragment key={index}>{part.text}</Fragment>))}</p>}
            </>
          )}
          <span className="message-meta">
            {message.edited_at && !deleted && <span>edited · </span>}
            <time dateTime={message.created_at} title={fullTime}>{time}</time>
            {message.pending && <span> · Sending…</span>}
          </span>
        </div>

        {props.reactions.length > 0 && (
          <div className="reaction-row">
            {props.reactions.map((r) => (
              <button key={r.emoji} type="button" className={`reaction-chip${r.mine ? ' mine' : ''}`} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}${r.mine ? ', including you' : ''}`} onClick={() => props.onReact(r.emoji)}>
                {r.emoji} <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {message.failed && (
          <p className="send-failed">Not sent. <button className="link-button" onClick={props.onRetry}>Try again</button> <button className="link-button" onClick={props.onDiscard}>Remove</button></p>
        )}
        {props.seenLabel && <p className={`seen-label${props.seenLabel === 'Seen' ? ' seen' : ''}`}>{props.seenLabel === 'Seen' ? '✓✓ Seen' : '✓ Sent'}</p>}
      </div>

      {!deleted && !message.pending && !message.failed && (
        <div className={`message-actions${props.actionsOpen || props.reacting ? ' open' : ''}`}>
          <button type="button" className="action-button secondary" aria-label="React" aria-expanded={props.reacting} onClick={props.onToggleReacting}>☺</button>
          <button type="button" className="action-button secondary" aria-label="Reply" onClick={props.onReply}>↩</button>
          <button type="button" className="action-button" aria-label="More options" aria-expanded={props.actionsOpen} onClick={props.onToggleActions}>⋯</button>
          {props.reacting && (
            <div className="reaction-picker" role="group" aria-label="Choose a reaction">
              {REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => props.onReact(emoji)} aria-label={`React with ${emoji}`}>{emoji}</button>)}
            </div>
          )}
          {props.actionsOpen && (
            <div className="action-menu" role="menu">
              <button role="menuitem" onClick={props.onReply}>Reply</button>
              {message.body && <button role="menuitem" onClick={props.onCopy}>Copy text</button>}
              {props.canEdit && <button role="menuitem" onClick={props.onEdit}>Edit</button>}
              {props.canDelete && <button role="menuitem" className="danger" onClick={props.onDelete}>Delete for everyone</button>}
              {props.canReport && <button role="menuitem" className="danger" onClick={props.onReport}>Report</button>}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

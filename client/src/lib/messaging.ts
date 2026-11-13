// Helpers for the messenger. Plain functions, so they're easy to test.

export const MESSAGE_COLUMNS = 'id, match_id, sender_id, body, created_at, attachment_path, attachment_type, deleted_at, deleted_by, reply_to_id, edited_at'

export type ChatMessage = {
  id: string
  match_id: string
  sender_id: string
  body: string
  created_at: string
  attachment_path: string | null
  attachment_type: string | null
  deleted_at: string | null
  deleted_by: string | null
  reply_to_id: string | null
  edited_at: string | null
  /** Only in the browser: still being sent, or sending failed. */
  pending?: boolean
  failed?: boolean
  /** Only in the browser: preview of a picture that is still uploading. */
  localImageUrl?: string
}

export type Reaction = { message_id: string; user_id: string; emoji: string }

/** Same window as the server (server/src/messages.js): edit or delete your own message within an hour. */
export const CHANGE_WINDOW_MS = 60 * 60 * 1000
export const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🎉'] as const
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const PAGE_SIZE = 50
/** Messages from the same person within this time are shown as one group under one name. */
const RUN_GAP_MS = 5 * 60 * 1000

export function canChange(message: Pick<ChatMessage, 'sender_id' | 'created_at' | 'deleted_at' | 'pending'>, actorId: string | undefined, now = Date.now()) {
  if (!actorId || message.deleted_at || message.pending) return false
  if (message.sender_id !== actorId) return false
  return now - new Date(message.created_at).getTime() <= CHANGE_WINDOW_MS
}

export type Run = { senderId: string; messages: ChatMessage[] }

/** Consecutive messages from the same sender, close together in time, become one run. */
export function groupRuns(messages: ChatMessage[]): Run[] {
  const runs: Run[] = []
  for (const message of messages) {
    const last = runs.at(-1)
    const previous = last?.messages.at(-1)
    const close = previous && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() <= RUN_GAP_MS
    if (last && last.senderId === message.sender_id && close) last.messages.push(message)
    else runs.push({ senderId: message.sender_id, messages: [message] })
  }
  return runs
}

const URL_PATTERN = /\b(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]|www\.[^\s<]+[^\s<.,:;"')\]!?])/gi

/** Splits text into plain parts and links, so links can be made clickable without HTML injection. */
export function linkParts(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start) })
    const url = match[0]
    parts.push({ text: url, href: url.startsWith('www.') ? `https://${url}` : url })
    last = start + url.length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

/** Escapes the wildcards of a SQL LIKE pattern, so a search for "50%" means 50%. */
export function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`)
}

/**
 * "Sent" or "Seen" for the last message the actor sent. Seen means someone else in the
 * conversation opened it after it was sent.
 */
export function seenState(messages: ChatMessage[], actorId: string | undefined, othersReadAt: (string | null | undefined)[]) {
  const lastOwn = [...messages].reverse().find((m) => m.sender_id === actorId && !m.deleted_at)
  if (!lastOwn || lastOwn.pending || lastOwn.failed) return null
  const seen = othersReadAt.some((readAt) => readAt && readAt >= lastOwn.created_at)
  return { messageId: lastOwn.id, label: seen ? 'Seen' : 'Sent' } as const
}

/** Index of the first message from someone else that arrived after the viewer last read the chat. */
export function firstUnreadIndex(messages: ChatMessage[], viewerId: string | undefined, readAt: string | null | undefined) {
  if (!readAt) return -1
  return messages.findIndex((m) => m.sender_id !== viewerId && m.created_at > readAt && !m.deleted_at)
}

export function summarizeReactions(reactions: Reaction[], messageId: string, actorId: string | undefined) {
  const counts = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const reaction of reactions) {
    if (reaction.message_id !== messageId) continue
    const entry = counts.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false }
    entry.count++
    if (reaction.user_id === actorId) entry.mine = true
    counts.set(reaction.emoji, entry)
  }
  return REACTIONS.flatMap((emoji) => (counts.has(emoji) ? [counts.get(emoji)!] : []))
}

export function imageProblem(file: Pick<File, 'type' | 'size'>) {
  if (!IMAGE_TYPES.includes(file.type)) return 'You can send JPG, PNG, WebP or GIF pictures.'
  if (file.size > MAX_IMAGE_BYTES) return 'Pictures can be at most 5 MB.'
  return null
}

type MatchPeople = { student_id: string; mentor_id: string }

export type SenderInfo = { kind: 'you' | 'student' | 'mentor' | 'team'; roleLabel: string }

/** Who wrote a message, from the point of view of the person looking at the chat. */
export function senderInfo(match: MatchPeople, senderId: string, viewerId: string | undefined): SenderInfo {
  if (senderId === viewerId) return { kind: 'you', roleLabel: 'You' }
  if (senderId === match.student_id) return { kind: 'student', roleLabel: 'Student' }
  if (senderId === match.mentor_id) return { kind: 'mentor', roleLabel: 'Mentor' }
  return { kind: 'team', roleLabel: 'MentorBridge team' }
}

/** One line for the conversation list: "You: …", "Photo", "Message deleted". */
export function previewText(message: Pick<ChatMessage, 'sender_id' | 'body' | 'attachment_path' | 'deleted_at'> | undefined, match: MatchPeople, viewerId: string | undefined) {
  if (!message) return 'No messages yet'
  const who = senderInfo(match, message.sender_id, viewerId)
  const prefix = who.kind === 'you' ? 'You: ' : who.kind === 'team' ? 'MentorBridge team: ' : ''
  if (message.deleted_at) return `${prefix}Message deleted`
  const text = message.body.trim() || (message.attachment_path ? 'Photo' : '')
  return `${prefix}${message.attachment_path && message.body.trim() ? 'Photo · ' : ''}${text}`
}

/** "14:05" today, "Tue" this week, "12 Nov" before that. */
export function shortTime(value: string, now = new Date()) {
  const date = new Date(value)
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date)
  const sixDays = 6 * 24 * 60 * 60 * 1000
  if (now.getTime() - date.getTime() < sixDays) return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date)
}

/** "today", "yesterday" or "12 Nov", for lines like "Matched today". */
export function dayLabel(value: string, now = new Date()) {
  const date = new Date(value)
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).format(date)
}

/** Messages per calendar day (in the viewer's time zone), oldest day first. */
export function groupByDay<T extends { created_at: string }>(messages: T[]) {
  const days: { key: string; label: string; messages: T[] }[] = []
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' })
  for (const message of messages) {
    const date = new Date(message.created_at)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const last = days.at(-1)
    if (last?.key === key) last.messages.push(message)
    else days.push({ key, label: formatter.format(date), messages: [message] })
  }
  return days
}

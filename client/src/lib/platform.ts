export type PlatformMessage = {
  id: string
  sender_id: string
  body: string
  created_at: string
}

export type PlatformSession = {
  id: string
  title: string | null
  starts_at: string
  duration_min: number
  meeting_url: string | null
  notes: string | null
  match_id: string
}

export function countUnreadMessages(
  messages: PlatformMessage[],
  userId: string,
  readAt: string | null,
) {
  const lastRead = readAt ? new Date(readAt).getTime() : 0
  return messages.filter(
    (message) => message.sender_id !== userId && new Date(message.created_at).getTime() > lastRead,
  ).length
}

export function groupMessagesByDay(messages: PlatformMessage[], locale?: string) {
  const groups = new Map<string, { label: string; messages: PlatformMessage[] }>()
  const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })

  for (const message of messages) {
    const date = new Date(message.created_at)
    const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    const group = groups.get(day)
    if (group) group.messages.push(message)
    else groups.set(day, { label: formatter.format(date), messages: [message] })
  }

  return [...groups.values()]
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function createIcsContent(session: PlatformSession, matchLabel: string) {
  const start = new Date(session.starts_at)
  const end = new Date(start.getTime() + session.duration_min * 60_000)
  const title = session.title?.trim() || 'MentorBridge session'
  const details = [matchLabel, session.notes, session.meeting_url].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MentorBridge//Schedule//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${session.id}@mentorbridge`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
type MatchNames = {
  student_id: string
  mentor_id: string
  student: { full_name: string | null } | null
  mentor: { full_name: string | null } | null
}

/**
 * The name to show for a match, from the viewer's side: a student sees their mentor,
 * a mentor their student, and admins and companies see both.
 */
export function matchLabel(match: MatchNames | undefined, role: string | undefined) {
  if (!match) return 'Your match'
  const student = match.student?.full_name ?? 'Student'
  const mentor = match.mentor?.full_name ?? 'Mentor'
  if (role === 'student') return match.mentor?.full_name ?? 'Your mentor'
  if (role === 'mentor') return match.student?.full_name ?? 'Your student'
  return `${student} with ${mentor}`
}

/** A message written by someone outside the pair: the MentorBridge team. */
export function isTeamMessage(message: Pick<PlatformMessage, 'sender_id'>, match: Pick<MatchNames, 'student_id' | 'mentor_id'>) {
  return message.sender_id !== match.student_id && message.sender_id !== match.mentor_id
}

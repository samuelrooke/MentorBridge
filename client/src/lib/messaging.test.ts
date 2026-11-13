import { describe, expect, it } from 'vitest'
import {
  CHANGE_WINDOW_MS, canChange, dayLabel, escapeLike, firstUnreadIndex, groupRuns, imageProblem, linkParts, previewText,
  seenState, senderInfo, summarizeReactions, type ChatMessage,
} from './messaging'

const base = { attachment_path: null, attachment_type: null, deleted_at: null, deleted_by: null, reply_to_id: null, edited_at: null, match_id: 'x' }
const msg = (id: string, sender_id: string, created_at: string, extra: Partial<ChatMessage> = {}): ChatMessage =>
  ({ ...base, id, sender_id, created_at, body: id, ...extra })

const match = { student_id: 'lisa', mentor_id: 'daan' }

describe('groupRuns', () => {
  it('groups consecutive messages from one sender within five minutes', () => {
    const runs = groupRuns([
      msg('1', 'lisa', '2026-11-13T10:00:00Z'),
      msg('2', 'lisa', '2026-11-13T10:03:00Z'),
      msg('3', 'daan', '2026-11-13T10:04:00Z'),
      msg('4', 'daan', '2026-11-13T10:20:00Z'),
    ])
    expect(runs.map((r) => r.messages.map((m) => m.id))).toEqual([['1', '2'], ['3'], ['4']])
  })
})

describe('linkParts', () => {
  it('finds links and leaves the rest as text', () => {
    expect(linkParts('See https://example.com/a?b=1. And www.thuas.nl!')).toEqual([
      { text: 'See ' },
      { text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { text: '. And ' },
      { text: 'www.thuas.nl', href: 'https://www.thuas.nl' },
      { text: '!' },
    ])
  })

  it('never turns other schemes into links', () => {
    expect(linkParts('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
  })
})

describe('canChange', () => {
  const now = new Date('2026-11-13T12:00:00Z').getTime()
  it('allows own messages within the hour only', () => {
    expect(canChange(msg('1', 'me', new Date(now - 60_000).toISOString()), 'me', now)).toBe(true)
    expect(canChange(msg('1', 'me', new Date(now - CHANGE_WINDOW_MS - 1).toISOString()), 'me', now)).toBe(false)
    expect(canChange(msg('1', 'other', new Date(now).toISOString()), 'me', now)).toBe(false)
    expect(canChange(msg('1', 'me', new Date(now).toISOString(), { deleted_at: 'x' }), 'me', now)).toBe(false)
  })
})

describe('seenState and firstUnreadIndex', () => {
  const messages = [msg('1', 'daan', '2026-11-13T10:00:00Z'), msg('2', 'lisa', '2026-11-13T10:05:00Z'), msg('3', 'daan', '2026-11-13T10:06:00Z')]

  it('says Seen once the other person read after the last own message', () => {
    expect(seenState(messages, 'lisa', ['2026-11-13T10:04:00Z'])).toEqual({ messageId: '2', label: 'Sent' })
    expect(seenState(messages, 'lisa', ['2026-11-13T10:07:00Z'])).toEqual({ messageId: '2', label: 'Seen' })
    expect(seenState(messages, 'nobody', [])).toBeNull()
  })

  it('finds the first unread message from someone else', () => {
    expect(firstUnreadIndex(messages, 'lisa', '2026-11-13T10:01:00Z')).toBe(2)
    expect(firstUnreadIndex(messages, 'lisa', null)).toBe(-1)
  })
})

describe('reactions, pictures and labels', () => {
  it('counts reactions per emoji in a fixed order and marks your own', () => {
    const summary = summarizeReactions([
      { message_id: 'm', user_id: 'a', emoji: '❤️' },
      { message_id: 'm', user_id: 'b', emoji: '👍' },
      { message_id: 'm', user_id: 'me', emoji: '👍' },
      { message_id: 'other', user_id: 'a', emoji: '🎉' },
    ], 'm', 'me')
    expect(summary).toEqual([{ emoji: '👍', count: 2, mine: true }, { emoji: '❤️', count: 1, mine: false }])
  })

  it('checks picture type and size', () => {
    expect(imageProblem({ type: 'image/png', size: 1000 })).toBeNull()
    expect(imageProblem({ type: 'application/pdf', size: 1000 })).toMatch(/JPG, PNG/)
    expect(imageProblem({ type: 'image/jpeg', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
  })

  it('says who wrote a message', () => {
    expect(senderInfo(match, 'lisa', 'lisa').kind).toBe('you')
    expect(senderInfo(match, 'daan', 'lisa')).toEqual({ kind: 'mentor', roleLabel: 'Mentor' })
    expect(senderInfo(match, 'admin', 'lisa')).toEqual({ kind: 'team', roleLabel: 'MentorBridge team' })
  })

  it('writes a preview line for the conversation list', () => {
    expect(previewText(msg('1', 'lisa', 'x', { body: 'Hi' }), match, 'lisa')).toBe('You: Hi')
    expect(previewText(msg('1', 'daan', 'x', { body: '', attachment_path: 'p' }), match, 'lisa')).toBe('Photo')
    expect(previewText(msg('1', 'admin', 'x', { body: '', deleted_at: 'y' }), match, 'lisa')).toBe('MentorBridge team: Message deleted')
    expect(previewText(undefined, match, 'lisa')).toBe('No messages yet')
  })

  it('escapes LIKE wildcards in searches', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\')
  })
})

describe('dayLabel', () => {
  const now = new Date('2026-11-13T15:00:00')
  it('says today, yesterday or the date', () => {
    expect(dayLabel('2026-11-13T09:00:00', now)).toBe('today')
    expect(dayLabel('2026-11-12T23:00:00', now)).toBe('yesterday')
    expect(dayLabel('2026-11-01T10:00:00', now)).not.toMatch(/today|yesterday/)
  })
})

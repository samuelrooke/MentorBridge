import { describe, expect, it } from 'vitest'
import { countUnreadMessages, createIcsContent, groupMessagesByDay, isTeamMessage, matchLabel, type PlatformMessage } from './platform'

const messages: PlatformMessage[] = [
  { id: '1', sender_id: 'other', body: 'Earlier', created_at: '2026-11-10T10:00:00.000Z' },
  { id: '2', sender_id: 'me', body: 'Reply', created_at: '2026-11-10T11:00:00.000Z' },
  { id: '3', sender_id: 'other', body: 'New day', created_at: '2026-11-11T09:00:00.000Z' },
]

describe('platform helpers', () => {
  it('counts only messages from others after the read marker', () => {
    expect(countUnreadMessages(messages, 'me', '2026-11-10T10:30:00.000Z')).toBe(1)
    expect(countUnreadMessages(messages, 'me', null)).toBe(2)
  })

  it('groups messages by the local calendar day', () => {
    expect(groupMessagesByDay(messages, 'en-GB').map((group) => group.messages.map(({ id }) => id))).toEqual([
      ['1', '2'],
      ['3'],
    ])
  })

  it('creates an importable UTC calendar event and escapes text', () => {
    const content = createIcsContent(
      {
        id: 'session-1',
        match_id: 'match-1',
        title: 'Interview, practice; prep',
        starts_at: '2026-11-12T10:00:00.000Z',
        duration_min: 45,
        meeting_url: 'https://example.test/meet',
        notes: 'Bring notes',
      },
      'Sam Student',
    )

    expect(content).toContain('DTSTART:20261112T100000Z\r\n')
    expect(content).toContain('DTEND:20261112T104500Z\r\n')
    expect(content).toContain('SUMMARY:Interview\\, practice\\; prep\r\n')
    expect(content).toContain('DESCRIPTION:Sam Student\\nBring notes\\nhttps://example.test/meet\r\n')
    expect(content).toContain('END:VCALENDAR\r\n')
  })

  it('names the other person, or both for admins and companies', () => {
    const match = { student_id: 's', mentor_id: 'm', student: { full_name: 'Lisa' }, mentor: { full_name: 'Daan' } }
    expect(matchLabel(match, 'student')).toBe('Daan')
    expect(matchLabel(match, 'mentor')).toBe('Lisa')
    expect(matchLabel(match, 'admin')).toBe('Lisa with Daan')
    expect(matchLabel(match, 'company')).toBe('Lisa with Daan')
    expect(matchLabel(undefined, 'student')).toBe('Your match')
  })

  it('recognises messages from the MentorBridge team', () => {
    const match = { student_id: 's', mentor_id: 'm' }
    expect(isTeamMessage({ sender_id: 'admin' }, match)).toBe(true)
    expect(isTeamMessage({ sender_id: 's' }, match)).toBe(false)
    expect(isTeamMessage({ sender_id: 'm' }, match)).toBe(false)
  })
})

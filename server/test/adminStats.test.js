import { describe, expect, it } from 'vitest'
import { matchesWithActivity, recentActivity, sourceOf, summarizeOverview, summarizeReviews } from '../src/adminStats.js'

const now = new Date('2026-11-13T12:00:00Z').getTime()
const day = (offset) => new Date(now + offset * 24 * 60 * 60 * 1000).toISOString()

const profiles = [
  { id: 's1', role: 'student', full_name: 'Lisa' },
  { id: 's2', role: 'student', full_name: 'Tom' },
  { id: 'm1', role: 'mentor', full_name: 'Daan' },
  { id: 'c1', role: 'company', full_name: 'Acme' },
  { id: 'a1', role: 'admin', full_name: 'Sam' },
]
const users = [
  { id: 's1', created_at: day(-1), email_confirmed_at: day(-1), email: 'lisa@x.nl', user_metadata: { signup_source: { utm_source: 'linkedin' } } },
  { id: 's2', created_at: day(-30), email_confirmed_at: null },
  { id: 'm1', created_at: day(-2), email_confirmed_at: day(-2) },
  { id: 'c1', created_at: day(-40), email_confirmed_at: day(-40) },
  { id: 'a1', created_at: day(-50), email_confirmed_at: day(-50) },
]
const matches = [
  { id: 'x1', student_id: 's1', mentor_id: 'm1', company_id: 'c1', status: 'active', created_at: day(-1) },
  { id: 'x2', student_id: 's2', mentor_id: 'm1', company_id: null, status: 'cancelled', created_at: day(-3) },
]
const sessions = [
  { id: 'e1', match_id: 'x1', starts_at: day(2) },
  { id: 'e2', match_id: 'x1', starts_at: day(10) },
  { id: 'e3', match_id: 'x1', starts_at: day(-5) },
]
const messages = [
  { id: 'g1', match_id: 'x1', created_at: day(-1) },
  { id: 'g2', match_id: 'x1', created_at: day(-20) },
]
const waitlist = [
  { id: 'w1', role: 'student', created_at: day(-1), utm_source: 'linkedin', name: 'Eva' },
  { id: 'w5', role: 'student', created_at: day(-60), email: 'LISA@x.nl', utm_source: 'instagram' },
  { id: 'w2', role: 'student', created_at: day(-9), referrer: 'google.com' },
  { id: 'w3', role: 'mentor', created_at: day(-2), utm_source: 'linkedin' },
  { id: 'w4', role: 'company', created_at: day(-3) },
]

describe('summarizeOverview', () => {
  const overview = summarizeOverview({ users, profiles, matches, sessions, messages, waitlist, contact: [{ id: 'k1' }] }, now)

  it('counts accounts by role, unconfirmed and new', () => {
    expect(overview.accounts).toEqual({ total: 5, byRole: { student: 2, mentor: 1, company: 1, admin: 1 }, unconfirmed: 1, newLast7Days: 2 })
  })

  it('counts matches by status and people without an open match', () => {
    expect(overview.matches.byStatus).toEqual({ proposed: 0, active: 1, completed: 0, cancelled: 1 })
    expect(overview.matches.studentsWithoutMatch).toBe(1)
    expect(overview.matches.mentorsWithoutMatch).toBe(0)
  })

  it('counts upcoming sessions and recent messages', () => {
    expect(overview.sessions).toEqual({ total: 3, upcoming: 2, next7Days: 1 })
    expect(overview.messages).toEqual({ total: 2, last7Days: 1 })
  })

  it('summarises the waiting list per segment', () => {
    expect(overview.waitlist.byRole).toEqual({ student: 3, mentor: 1, company: 1 })
    expect(overview.waitlist.last7Days).toBe(3)
  })

  it('counts sign-ups from accounts and the waiting list once per email', () => {
    // Lisa has an account and an older waiting list entry: her account's source counts, not the entry.
    expect(overview.waitlist.bySource).toEqual([
      { source: 'linkedin', total: 3 },
      { source: 'google.com', total: 1 },
      { source: 'direct', total: 1 },
    ])
    // Accounts: 2 students, 1 mentor, 1 company. Waiting list only: 2 students, 1 mentor, 1 company.
    expect(overview.waitlist.targets).toEqual([
      { role: 'student', signups: 4, target: 500 },
      { role: 'mentor', signups: 2, target: 1000 },
      { role: 'company', signups: 2, target: 50 },
    ])
  })
})

describe('matchesWithActivity', () => {
  it('adds names, session and message activity per match', () => {
    const [first] = matchesWithActivity({ matches, profiles, sessions, messages }, now)
    expect(first).toMatchObject({
      id: 'x1', student_name: 'Lisa', mentor_name: 'Daan', company_name: 'Acme',
      session_count: 3, next_session_at: day(2), message_count: 2, last_message_at: day(-1),
    })
  })
})

describe('recentActivity and sourceOf', () => {
  it('merges events newest first', () => {
    const events = recentActivity({ users, profiles, waitlist, contact: [] }, 3)
    expect(events.map((e) => e.label)).toEqual(['Lisa', 'Eva', 'Daan'])
  })

  it('prefers the UTM source, then the referrer', () => {
    expect(sourceOf({ utm_source: 'x', referrer: 'y' })).toBe('x')
    expect(sourceOf({ referrer: 'y' })).toBe('y')
    expect(sourceOf({})).toBe('direct')
  })
})

describe('summarizeReviews', () => {
  it('averages ratings of sessions that took place and counts no-shows', () => {
    expect(summarizeReviews([
      { rating: 5, took_place: true },
      { rating: 4, took_place: true },
      { rating: null, took_place: false },
    ])).toEqual({ total: 3, average: 4.5, notTookPlace: 1 })
    expect(summarizeReviews([])).toEqual({ total: 0, average: null, notTookPlace: 0 })
  })
})

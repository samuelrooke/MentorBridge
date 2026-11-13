import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'
import { UNSEND_WINDOW_MS, canUnsend } from '../src/messages.js'
import { summarizeCompanyMatches } from '../src/routes/company.js'

const now = new Date('2026-11-13T12:00:00Z').getTime()
const ago = (ms) => new Date(now - ms).toISOString()

describe('canUnsend', () => {
  const own = { sender_id: 'me', created_at: ago(10 * 60 * 1000), deleted_at: null }

  it('allows your own message within the window', () => {
    expect(canUnsend(own, 'me', now)).toBe(true)
    expect(canUnsend({ ...own, created_at: ago(UNSEND_WINDOW_MS) }, 'me', now)).toBe(true)
  })

  it('refuses after the window, for other people and for deleted messages', () => {
    expect(canUnsend({ ...own, created_at: ago(UNSEND_WINDOW_MS + 1000) }, 'me', now)).toBe(false)
    expect(canUnsend(own, 'someone-else', now)).toBe(false)
    expect(canUnsend({ ...own, deleted_at: ago(1000) }, 'me', now)).toBe(false)
    expect(canUnsend(null, 'me', now)).toBe(false)
  })
})

describe('summarizeCompanyMatches', () => {
  const day = 24 * 60 * 60 * 1000
  const data = {
    matches: [
      { id: 'x1', student_id: 's1', mentor_id: 'm1', status: 'active', created_at: ago(5 * day) },
      { id: 'x2', student_id: 's2', mentor_id: 'm1', status: 'active', created_at: ago(2 * day) },
      { id: 'x3', student_id: 's3', mentor_id: 'm1', status: 'active', created_at: ago(1 * day) },
    ],
    consents: [{ match_id: 'x1', revoked_at: null }, { match_id: 'x2', revoked_at: ago(day) }],
    profiles: [{ id: 's1', full_name: 'Lisa' }, { id: 'm1', full_name: 'Daan' }, { id: 's2', full_name: 'Tom' }],
    sessions: [
      { match_id: 'x1', starts_at: ago(day) },
      { match_id: 'x1', starts_at: new Date(now + day).toISOString() },
      { match_id: 'x2', starts_at: ago(day) },
    ],
    activities: [{ match_id: 'x1', completed_at: ago(day) }, { match_id: 'x1', completed_at: null }],
  }

  it('shows only matches the student shared, with counts and no session details', () => {
    const summary = summarizeCompanyMatches(data, now)
    expect(summary.waitingForConsent).toBe(2)
    expect(summary.interns).toEqual([{
      match_id: 'x1', status: 'active', matched_at: ago(5 * day), student_name: 'Lisa', mentor_name: 'Daan',
      sessions_held: 1, sessions_planned: 1, plan_done: 1, plan_total: 2,
    }])
  })
})

describe('auth on the new routes', () => {
  it('needs a login to unsend a message or see the company overview', async () => {
    expect((await request(app).post('/api/messages/00000000-0000-0000-0000-000000000000/unsend')).status).toBe(401)
    expect((await request(app).get('/api/company/overview')).status).toBe(401)
  })
})

import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'
import { validateAnswers, validatePilotRequest } from '../src/routes/pilotRequests.js'

const valid = { email: 'Lead@Example.com', company: 'Acme', interns_per_year: '3-5' }

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('auth', () => {
  it('rejects /api/me without a token', async () => {
    const res = await request(app).get('/api/me')
    expect(res.status).toBe(401)
  })
})

describe('validatePilotRequest', () => {
  it('accepts and cleans a valid request', () => {
    expect(validatePilotRequest(valid)).toEqual({
      role: 'company',
      email: 'lead@example.com',
      company: 'Acme',
      interns_per_year: '3-5',
    })
  })

  it('accepts a student or mentor with a field, ignoring company fields', () => {
    expect(validatePilotRequest({ role: 'student', email: 'S@x.nl', field: ' ICT ', company: 'Acme' })).toEqual({
      role: 'student',
      email: 's@x.nl',
      field: 'ICT',
    })
    expect(validatePilotRequest({ role: 'mentor', email: 'm@x.nl', field: 'Backend' }).role).toBe('mentor')
  })

  it.each([
    [{ ...valid, email: '' }, 'your email'],
    [{ ...valid, email: 'not-an-email' }, 'valid email'],
    [{ ...valid, email: `${'a'.repeat(250)}@x.com` }, 'valid email'],
    [{ ...valid, company: '  ' }, 'organization name'],
    [{ ...valid, company: 'x'.repeat(201) }, '200 characters'],
    [{ ...valid, interns_per_year: '100' }, 'interns'],
    [{ ...valid, role: 'admin' }, 'student, mentor or organization'],
    [{ role: 'student', email: 'a@b.co' }, 'field of study'],
    [{ role: 'mentor', email: 'a@b.co', field: 'x'.repeat(201) }, '200 characters'],
  ])('rejects %j', (body, reason) => {
    expect(validatePilotRequest(body).error).toContain(reason)
  })
})

describe('POST /api/pilot-requests', () => {
  it('returns 400 with a reason on invalid input', async () => {
    const res = await request(app).post('/api/pilot-requests').send({ ...valid, email: 'nope' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/valid email/)
  })

  it('returns 400 on malformed JSON', async () => {
    const res = await request(app).post('/api/pilot-requests').set('Content-Type', 'application/json').send('{bad')
    expect(res.status).toBe(400)
  })

  it('silently accepts honeypot submissions without storing them', async () => {
    const res = await request(app).post('/api/pilot-requests').send({ ...valid, website: 'spam.example' })
    expect(res.status).toBe(201)
  })
})

describe('CORS', () => {
  it('allows localhost in development', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5174')
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174')
  })

  it('does not allow other origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example')
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('validateAnswers', () => {
  it('accepts a full set of answers', () => {
    expect(
      validateAnswers({ has_placement: 'no', applications_sent: '11-30', help_wanted: ['cv', 'interviews', 'cv'], needed_by: '0-3' }),
    ).toEqual({ has_placement: 'no', applications_sent: '11-30', help_wanted: ['cv', 'interviews'], needed_by: '0-3' })
  })

  it('treats skipped questions as empty', () => {
    expect(validateAnswers({ has_placement: null, help_wanted: [] })).toEqual({})
  })

  it.each([
    [{ has_placement: 'maybe' }, 'yes or no'],
    [{ applications_sent: '1000' }, 'applications'],
    [{ needed_by: 'tomorrow' }, 'when you need'],
    [{ help_wanted: ['cv', 'money'] }, 'listed kinds of help'],
  ])('rejects %j', (body, reason) => {
    expect(validateAnswers(body).error).toContain(reason)
  })
})

describe('PATCH /api/pilot-requests/:id/answers', () => {
  it('returns 404 for an id that is not a uuid', async () => {
    const res = await request(app).patch('/api/pilot-requests/not-an-id/answers').send({ has_placement: 'yes' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for an invalid answer', async () => {
    const res = await request(app)
      .patch('/api/pilot-requests/123e4567-e89b-12d3-a456-426614174000/answers')
      .send({ has_placement: 'maybe' })
    expect(res.status).toBe(400)
  })
})

import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app from '../src/app.js'
import { validatePilotRequest } from '../src/routes/pilotRequests.js'

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
    expect(validatePilotRequest(valid)).toEqual({ email: 'lead@example.com', company: 'Acme', interns_per_year: '3-5' })
  })

  it.each([
    [{ ...valid, email: '' }, 'work email'],
    [{ ...valid, email: 'not-an-email' }, 'valid email'],
    [{ ...valid, email: `${'a'.repeat(250)}@x.com` }, 'valid email'],
    [{ ...valid, company: '  ' }, 'company name'],
    [{ ...valid, company: 'x'.repeat(201) }, '200 characters'],
    [{ ...valid, interns_per_year: '100' }, 'interns'],
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

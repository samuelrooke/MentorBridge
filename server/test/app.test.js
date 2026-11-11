import request from 'supertest'
import { describe, expect, it } from 'vitest'
import app, { parseOrigins } from '../src/app.js'
import { validateAnswers, validatePilotRequest } from '../src/routes/pilotRequests.js'

const valid = {
  role: 'company',
  name: 'Mark Bakker',
  email: 'Lead@Example.com',
  company: 'Acme',
  job_title: 'HR manager',
  sector: 'construction',
  consent: true,
}
const mentor = { role: 'mentor', name: 'Pieter', email: 'p@x.nl', age_range: '60-64', hours_per_month: '3-5', availability: ['evenings'], consent: true }
const student = { role: 'student', name: 'Lisa', email: 'l@x.nl', sector: 'ict', skills_help: 'both', availability: ['weekdays', 'weekends'], consent: true }

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
  it('accepts and cleans a company sign-up', () => {
    expect(validatePilotRequest({ ...valid, company_size: '250-999', interest: 'internal', interns_per_year: '3-5' })).toEqual({
      role: 'company',
      name: 'Mark Bakker',
      email: 'lead@example.com',
      sector: 'construction',
      company: 'Acme',
      job_title: 'HR manager',
      company_size: '250-999',
      interest: 'internal',
    })
  })

  it('accepts a mentor without a sector and a student with one', () => {
    expect(validatePilotRequest(mentor)).toEqual({
      role: 'mentor', name: 'Pieter', email: 'p@x.nl', availability: ['evenings'], age_range: '60-64', hours_per_month: '3-5',
    })
    expect(validatePilotRequest({ ...mentor, sector: 'logistics' }).sector).toBe('logistics')
    expect(validatePilotRequest({ ...student, availability: ['weekends', 'weekdays', 'weekends'] })).toEqual({
      role: 'student', name: 'Lisa', email: 'l@x.nl', sector: 'ict', availability: ['weekdays', 'weekends'], skills_help: 'both',
    })
  })

  it('keeps the visitor source and drops anything odd', () => {
    const result = validatePilotRequest({
      ...student,
      utm_source: ' LinkedIn ',
      utm_medium: 'social',
      utm_campaign: 'x'.repeat(150),
      referrer: 'www.linkedin.com',
      landing_path: '/students/',
    })
    expect(result).toMatchObject({ utm_source: 'linkedin', utm_medium: 'social', referrer: 'www.linkedin.com', landing_path: '/students/' })
    expect(result.utm_campaign).toHaveLength(100)
    const odd = validatePilotRequest({ ...student, referrer: 'https://x.com/a?b', landing_path: 'http://evil' })
    expect(odd).not.toHaveProperty('referrer')
    expect(odd).not.toHaveProperty('landing_path')
  })

  it.each([
    [{ ...valid, email: '' }, 'your email'],
    [{ ...valid, email: 'not-an-email' }, 'valid email'],
    [{ ...valid, email: 'a'.repeat(250) + '@x.com' }, 'valid email'],
    [{ ...valid, name: ' ' }, 'contact name'],
    [{ ...valid, company: '  ' }, 'company name'],
    [{ ...valid, company: 'x'.repeat(201) }, '200 characters'],
    [{ ...valid, job_title: '' }, 'your role'],
    [{ ...valid, sector: undefined }, 'choose a sector'],
    [{ ...valid, sector: 'mining' }, 'sector from the list'],
    [{ ...valid, company_size: '5' }, 'company size'],
    [{ ...valid, interest: 'resell' }, 'how you would like'],
    [{ ...valid, role: 'admin' }, 'student, mentor or company'],
    [{ ...valid, role: undefined }, 'student, mentor or company'],
    [{ ...valid, consent: 'yes' }, 'privacy statement'],
    [{ ...mentor, age_range: '50' }, 'age range'],
    [{ ...mentor, hours_per_month: undefined }, 'hours a month'],
    [{ ...mentor, availability: [] }, 'when you are available'],
    [{ ...student, availability: ['nights'] }, 'listed times'],
    [{ ...student, skills_help: 'cv' }, 'help with'],
    [{ ...student, sector: '' }, 'choose a sector'],
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

  it('reads several comma-separated origins', () => {
    expect(parseOrigins('https://a.example/, https://b.example', undefined)).toEqual(['https://a.example', 'https://b.example'])
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

describe('A/B variant on sign-ups', () => {
  it('keeps a valid variant and drops anything else', () => {
    expect(validatePilotRequest({ ...student, variant: 'b' }).variant).toBe('b')
    expect(validatePilotRequest({ ...student, variant: 'z' })).not.toHaveProperty('variant')
  })
})

describe('POST /api/contact', () => {
  it('validates the message', async () => {
    const { validateContact } = await import('../src/routes/contact.js')
    expect(validateContact({ name: ' Sam ', email: 'S@x.nl', message: ' Hi ' })).toEqual({ name: 'Sam', email: 's@x.nl', message: 'Hi' })
    expect(validateContact({ name: '', email: 's@x.nl', message: 'Hi' }).error).toContain('name')
    expect(validateContact({ name: 'Sam', email: 'nope', message: 'Hi' }).error).toContain('valid email')
    expect(validateContact({ name: 'Sam', email: 's@x.nl', message: '' }).error).toContain('message')
    expect(validateContact({ name: 'Sam', email: 's@x.nl', message: 'x'.repeat(2001) }).error).toContain('2000')
  })

  it('returns 400 on invalid input and 201 for the honeypot', async () => {
    expect((await request(app).post('/api/contact').send({ name: 'Sam', email: 'x', message: 'Hi' })).status).toBe(400)
    expect((await request(app).post('/api/contact').send({ website: 'spam' })).status).toBe(201)
  })
})

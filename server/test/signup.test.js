import { describe, expect, it } from 'vitest'
import { allowAttempt, validateSignup } from '../src/routes/signup.js'

const valid = { role: 'student', first_name: ' Lisa ', last_name: 'de Vries', email: 'Lisa@Example.com ', password: 'secret123' }

describe('validateSignup', () => {
  it('accepts a student and builds the account metadata', () => {
    const { value, error } = validateSignup({ ...valid, utm_source: 'linkedin', landing_path: '/students/' })
    expect(error).toBeUndefined()
    expect(value.email).toBe('lisa@example.com')
    expect(value.company).toBeNull()
    expect(value.metadata).toMatchObject({
      role: 'student', first_name: 'Lisa', last_name: 'de Vries', full_name: 'Lisa de Vries',
      signup_source: { utm_source: 'linkedin', landing_path: '/students/', referrer: null },
    })
  })

  it('needs a company name for companies only', () => {
    expect(validateSignup({ ...valid, role: 'company' }).error).toMatch(/company name/)
    expect(validateSignup({ ...valid, role: 'company', company: 'Acme' }).value.company).toBe('Acme')
    expect(validateSignup({ ...valid, role: 'mentor', company: 'Ignored' }).value.company).toBeNull()
  })

  it('refuses admin, short passwords, bad emails and missing names', () => {
    expect(validateSignup({ ...valid, role: 'admin' }).error).toMatch(/student, mentor or company/)
    expect(validateSignup({ ...valid, password: 'short' }).error).toMatch(/8 characters/)
    expect(validateSignup({ ...valid, email: 'not-an-email' }).error).toMatch(/valid email/)
    expect(validateSignup({ ...valid, first_name: '  ' }).error).toMatch(/first name/)
    expect(validateSignup({ ...valid, last_name: '' }).error).toMatch(/surname/)
  })
})

describe('allowAttempt', () => {
  it('allows ten sign-ups per address in ten minutes', () => {
    const now = 1_000_000
    for (let i = 0; i < 10; i++) expect(allowAttempt('1.2.3.4', now + i)).toBe(true)
    expect(allowAttempt('1.2.3.4', now + 20)).toBe(false)
    expect(allowAttempt('5.6.7.8', now + 20)).toBe(true)
    expect(allowAttempt('1.2.3.4', now + 10 * 60 * 1000 + 1)).toBe(true)
  })
})

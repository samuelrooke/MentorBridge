import { describe, expect, it } from 'vitest'
import { matchesSearch, toCsv } from './admin'

describe('toCsv', () => {
  it('writes a header and rows in column order', () => {
    expect(toCsv([{ name: 'Lisa', role: 'student', extra: 'x' }], ['role', 'name'])).toBe('role,name\r\nstudent,Lisa\r\n')
  })

  it('quotes commas, quotes and line breaks, and joins lists', () => {
    const csv = toCsv([{ a: 'one, two', b: 'say "hi"', c: 'line\nbreak', d: ['weekdays', 'evenings'] }], ['a', 'b', 'c', 'd'])
    expect(csv).toBe('a,b,c,d\r\n"one, two","say ""hi""","line\nbreak","weekdays; evenings"\r\n')
  })

  it('keeps cells that look like formulas as plain text', () => {
    expect(toCsv([{ name: '=HYPERLINK("x")' }, { name: '+31 6' }, { name: '-5' }], ['name']))
      .toBe('name\r\n"\'=HYPERLINK(""x"")"\r\n\'+31 6\r\n\'-5\r\n')
  })

  it('leaves empty values empty', () => {
    expect(toCsv([{ a: null, b: undefined }], ['a', 'b'])).toBe('a,b\r\n,\r\n')
  })
})

describe('matchesSearch', () => {
  it('finds text in any field, ignoring case', () => {
    expect(matchesSearch('LISA', 'Lisa de Vries', null)).toBe(true)
    expect(matchesSearch('gmail', null, 'lisa@gmail.com')).toBe(true)
    expect(matchesSearch('tom', 'Lisa', 'lisa@x.nl')).toBe(false)
    expect(matchesSearch('  ', 'anything')).toBe(true)
  })
})

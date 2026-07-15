import { describe, it, expect } from 'vitest'
import { formatPhone } from './format'

describe('formatPhone', () => {
  it('formats a 10-digit US number', () => {
    expect(formatPhone('2089252393')).toBe('(208) 925-2393')
  })

  it('formats an 11-digit number with leading 1 (country code)', () => {
    expect(formatPhone('12089252393')).toBe('(208) 925-2393')
    expect(formatPhone('+1 208 925 2393')).toBe('(208) 925-2393')
  })

  it('strips existing punctuation and reformats', () => {
    expect(formatPhone('208-925-2393')).toBe('(208) 925-2393')
    expect(formatPhone('(208) 925.2393')).toBe('(208) 925-2393')
  })

  it('returns non-standard input unchanged (graceful)', () => {
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone('ext. 5')).toBe('ext. 5')
  })

  it('handles empty / nullish input without throwing', () => {
    expect(formatPhone('')).toBe('')
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
  })

  it('preserves an extension suffix on a standard number', () => {
    expect(formatPhone('2089252393 x12')).toBe('(208) 925-2393 x12')
  })
})

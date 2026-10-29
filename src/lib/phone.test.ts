import { describe, it, expect } from 'vitest'
import { toE164 } from './phone'

describe('toE164', () => {
  it('stores +1 and ten digits', () => {
    expect(toE164('+12089380025')).toBe('+12089380025')
    expect(toE164('12089380025')).toBe('+12089380025')
    expect(toE164('+1 208 938 0025')).toBe('+12089380025')
  })

  it('stores dashes as +1 and ten digits', () => {
    expect(toE164('208-938-0025')).toBe('+12089380025')
  })

  it('stores parentheses as +1 and ten digits', () => {
    expect(toE164('(208) 938-0025')).toBe('+12089380025')
  })

  it('rejects a value that is not ten digits', () => {
    expect(toE164('12345')).toBeNull()
    expect(toE164('208-938')).toBeNull()
    expect(toE164('not a phone')).toBeNull()
  })

  it('leaves empty empty', () => {
    expect(toE164('')).toBe('')
    expect(toE164('   ')).toBe('')
    expect(toE164(null)).toBe('')
    expect(toE164(undefined)).toBe('')
  })
})

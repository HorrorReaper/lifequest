import { describe, expect, it } from 'vitest'
import { isDecimalDraft, parseDecimal } from './decimal'

describe('parseDecimal', () => {
  it('reads a comma and a point the same way', () => {
    expect(parseDecimal('72,5')).toBe(72.5)
    expect(parseDecimal('72.5')).toBe(72.5)
    expect(parseDecimal(' 80 ')).toBe(80)
    expect(parseDecimal('-1,25')).toBe(-1.25)
  })

  it('has no number for a blank or a half-typed value', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('-')).toBeNull()
    expect(parseDecimal(',')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('7,5,1')).toBeNull()
  })

  it('treats a trailing separator as the whole number while typing', () => {
    expect(parseDecimal('72,')).toBe(72)
  })
})

describe('isDecimalDraft', () => {
  it('lets a number be typed character by character', () => {
    for (const text of ['', '-', '7', '72', '72,', '72,5', '72.55']) {
      expect(isDecimalDraft(text)).toBe(true)
    }
  })

  it('refuses what can never become a number', () => {
    for (const text of ['a', '72kg', '7,5,1', '1 2', '--1']) {
      expect(isDecimalDraft(text)).toBe(false)
    }
  })
})

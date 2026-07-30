import { describe, expect, it } from 'vitest'
import { safeNextPath } from './auth-redirect'

describe('safeNextPath', () => {
  it('accepts a same-origin absolute path', () => {
    expect(safeNextPath('/reset-password')).toBe('/reset-password')
  })

  it('keeps a query string on an accepted path', () => {
    expect(safeNextPath('/dashboard?quick=task')).toBe('/dashboard?quick=task')
  })

  it('rejects a protocol-relative target', () => {
    expect(safeNextPath('//evil.com')).toBeNull()
  })

  it('rejects the backslash variant browsers normalize to //', () => {
    expect(safeNextPath('/\\evil.com')).toBeNull()
  })

  it('rejects an absolute URL', () => {
    expect(safeNextPath('https://evil.com')).toBeNull()
  })

  it('rejects a relative path that would resolve against the callback route', () => {
    expect(safeNextPath('dashboard')).toBeNull()
  })

  it('returns null for missing values', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
    expect(safeNextPath('')).toBeNull()
  })
})

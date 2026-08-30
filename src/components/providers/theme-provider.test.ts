import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyMode, resolveMode } from '@/components/providers/theme-provider'

function mockMatchMedia(prefersDark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && prefersDark,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })))
}

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
})

describe('resolveMode', () => {
  it('resolves the three explicit themes to themselves', () => {
    expect(resolveMode('white')).toBe('white')
    expect(resolveMode('trail')).toBe('trail')
    expect(resolveMode('dark')).toBe('dark')
  })

  it('resolves "light" to the light mode directly', () => {
    expect(resolveMode('light')).toBe('light')
  })

  it('resolves "system" from the OS preference', () => {
    mockMatchMedia(true)
    expect(resolveMode('system')).toBe('dark')

    mockMatchMedia(false)
    expect(resolveMode('system')).toBe('light')
  })
})

describe('applyMode', () => {
  it('is mutually exclusive: only one mode class is present at a time', () => {
    applyMode('white', 'class')
    let el = document.documentElement
    expect(el.classList.contains('white-mode')).toBe(true)
    expect(el.classList.contains('trail-mode')).toBe(false)
    expect(el.classList.contains('dark')).toBe(false)

    applyMode('trail', 'class')
    el = document.documentElement
    expect(el.classList.contains('white-mode')).toBe(false)
    expect(el.classList.contains('trail-mode')).toBe(true)
    expect(el.classList.contains('dark')).toBe(false)

    applyMode('dark', 'class')
    expect(el.classList.contains('white-mode')).toBe(false)
    expect(el.classList.contains('trail-mode')).toBe(false)
    expect(el.classList.contains('dark')).toBe(true)
  })

  it('clears every mode class for the plain light mode', () => {
    applyMode('dark', 'class')
    applyMode('light', 'class')

    const el = document.documentElement
    expect(el.classList.contains('dark')).toBe(false)
    expect(el.classList.contains('white-mode')).toBe(false)
    expect(el.classList.contains('trail-mode')).toBe(false)
  })

  it('uses data-theme instead of a dark class when attribute is "data-theme"', () => {
    applyMode('dark', 'data-theme')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    applyMode('trail', 'data-theme')
    // trail and white still apply as classes regardless of the dark attribute mode,
    // since only the dark/light split switches representation.
    expect(document.documentElement.classList.contains('trail-mode')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

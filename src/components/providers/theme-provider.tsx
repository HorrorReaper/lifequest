'use client'

import * as React from 'react'

const THEMES = ['light', 'dark', 'system', 'white', 'trail'] as const
export type Theme = (typeof THEMES)[number]

/**
 * The mutually-exclusive looks a theme can resolve to. "system" and "light"
 * are not modes themselves — {@link resolveMode} turns every {@link Theme}
 * into one of these before it reaches the DOM.
 */
export type Mode = 'dark' | 'white' | 'trail' | 'light'

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: 'class' | 'data-theme'
  defaultTheme?: Theme
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

const ThemeContext = React.createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
} | null>(null)

function isTheme(value: string | null): value is Theme {
  return THEMES.includes(value as Theme)
}

function getStoredTheme() {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('theme')
  return isTheme(stored) ? stored : null
}

/** Resolves a stored/selected theme to the mode that should actually be applied. */
export function resolveMode(theme: Theme): Mode {
  if (theme === 'white' || theme === 'trail' || theme === 'dark') return theme
  if (theme === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return 'light'
}

/**
 * Applies a resolved mode to `<html>`. Each mode is its own class so a new
 * one (e.g. adding `trail`) only means toggling one more class here, not a
 * new chain of `isX` booleans — that chain was already duplicated once
 * between the initial-load effect and `setTheme` below, and a third mode
 * would have made it worse.
 */
export function applyMode(mode: Mode, attribute: 'class' | 'data-theme') {
  const el = document.documentElement
  el.classList.toggle('white-mode', mode === 'white')
  el.classList.toggle('trail-mode', mode === 'trail')

  if (attribute === 'class') {
    el.classList.toggle('dark', mode === 'dark')
  } else {
    el.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light')
  }
}

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'light',
  enableSystem = false,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>('system')

  React.useEffect(() => {
    const applyTheme = (t: Theme) => {
      if (disableTransitionOnChange) {
        const el = document.documentElement
        el.classList.add('disable-transitions')
        // force reflow then remove
        void el.offsetWidth
        setTimeout(() => el.classList.remove('disable-transitions'), 0)
      }

      applyMode(resolveMode(t), attribute)
    }

    const resolveInitial = () => {
      const stored = getStoredTheme()
      if (stored) return (stored as Theme)
      if (enableSystem) return 'system'
      return defaultTheme
    }

    const initial = resolveInitial()
    setThemeState(initial)
    applyTheme(initial)

    let mq: MediaQueryList | null = null
    const handleChange = () => {
      const stored = getStoredTheme()
      if (stored === 'system' || (!stored && enableSystem)) {
        applyTheme('system')
      }
    }

    if (enableSystem && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq.addEventListener) mq.addEventListener('change', handleChange)
      else mq.addListener(handleChange)
    }

    return () => {
      if (!mq) return
      if (mq.removeEventListener) mq.removeEventListener('change', handleChange)
      else mq.removeListener(handleChange)
    }
  }, [attribute, defaultTheme, enableSystem, disableTransitionOnChange])

  const setTheme = React.useCallback((t: Theme) => {
    try {
      localStorage.setItem('theme', t)
    } catch {}
    applyMode(resolveMode(t), attribute)
    setThemeState(t)
  }, [attribute])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) return { theme: 'system' as Theme, setTheme: () => {} }
  return ctx
}

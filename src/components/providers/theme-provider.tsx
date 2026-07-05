'use client'

import * as React from 'react'

const THEMES = ['light', 'dark', 'system', 'white'] as const
export type Theme = (typeof THEMES)[number]

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
      const el = document.documentElement
      const isWhite = t === 'white'
      const isDark =
        !isWhite &&
        (t === 'dark' ||
          (t === 'system' &&
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches))

      if (disableTransitionOnChange) {
        el.classList.add('disable-transitions')
        // force reflow then remove
        void el.offsetWidth
        setTimeout(() => el.classList.remove('disable-transitions'), 0)
      }

      el.classList.toggle('white-mode', isWhite)

      if (attribute === 'class') {
        if (isDark) el.classList.add('dark')
        else el.classList.remove('dark')
      } else {
        el.setAttribute('data-theme', isDark ? 'dark' : 'light')
      }
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
    // apply immediately
    const el = document.documentElement
    const isWhite = t === 'white'
    const isDark =
      !isWhite &&
      (t === 'dark' ||
        (t === 'system' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches))
    el.classList.toggle('white-mode', isWhite)
    if (attribute === 'class') {
      if (isDark) el.classList.add('dark')
      else el.classList.remove('dark')
    } else {
      el.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }
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

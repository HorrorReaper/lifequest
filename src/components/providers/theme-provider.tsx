'use client'

import * as React from 'react'

type Theme = 'light' | 'dark' | 'system'

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

export function ThemeProvider({
  children,
  attribute = 'class',
  defaultTheme = 'light',
  enableSystem = false,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>('system')

  React.useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const applyTheme = (t: Theme) => {
      const el = document.documentElement
      const isDark = t === 'dark' || (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)

      if (disableTransitionOnChange) {
        el.classList.add('disable-transitions')
        // force reflow then remove
        void el.offsetWidth
        setTimeout(() => el.classList.remove('disable-transitions'), 0)
      }

      if (attribute === 'class') {
        if (isDark) el.classList.add('dark')
        else el.classList.remove('dark')
      } else {
        el.setAttribute('data-theme', isDark ? 'dark' : 'light')
      }
    }

    const resolveInitial = () => {
      if (stored) return (stored as Theme)
      if (enableSystem) return 'system'
      return defaultTheme
    }

    const initial = resolveInitial()
    setThemeState(initial)
    applyTheme(initial)

    let mq: MediaQueryList | null = null
    const handleChange = () => {
      // if using system and no stored override, re-apply
      const currentStored = localStorage.getItem('theme')
      if (!currentStored && enableSystem) {
        applyTheme('system')
      }
    }

    if (enableSystem && window.matchMedia) {
      mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener ? mq.addEventListener('change', handleChange) : mq.addListener(handleChange as any)
    }

    return () => {
      if (mq) mq.removeEventListener ? mq.removeEventListener('change', handleChange) : mq.removeListener(handleChange as any)
    }
  }, [attribute, defaultTheme, enableSystem, disableTransitionOnChange])

  const setTheme = React.useCallback((t: Theme) => {
    try {
      localStorage.setItem('theme', t)
    } catch {}
    // apply immediately
    const el = document.documentElement
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
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
  if (!ctx) return { theme: 'system' as Theme, setTheme: (_: Theme) => {} }
  return ctx
}

'use client'

import { useCallback, useState } from 'react'

export interface Gain {
  id: string
  amount: number
}

/**
 * The increases of `value` since this component mounted, each kept until
 * `dismiss` is called with its id (when its animation has played).
 *
 * The first value is the baseline, so loading a page or the shell's first
 * sync with the server shows nothing; only a change after that counts, and
 * only upwards -- unticking a habit takes XP back without a "-10". With
 * `enabled` false (reduced motion) nothing is collected at all.
 *
 * Tracked by comparing against the previous value during render, React's
 * pattern for state that follows a changing input, rather than in an effect.
 */
export function useGains(value: number, enabled = true) {
  const [previous, setPrevious] = useState(value)
  const [gains, setGains] = useState<Gain[]>([])

  if (value !== previous) {
    setPrevious(value)
    if (enabled && value > previous) {
      setGains((current) => [...current, { id: `${previous}->${value}`, amount: value - previous }])
    }
  }

  const dismiss = useCallback((id: string) => {
    setGains((current) => current.filter((gain) => gain.id !== id))
  }, [])

  return { gains, dismiss }
}

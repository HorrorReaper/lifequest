'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logMetricValue } from '@/lib/metrics'

/**
 * The save half of logging a metric value, shared by the log dialog and the
 * log box on the metric page: one write at a time, an error message when it
 * fails, and a router refresh when it succeeds so the server-rendered values
 * catch up.
 *
 * `log` resolves to whether the value was saved.
 */
export function useLogMetricValue(userId: string) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Blocks a second submit in the same frame, before `busy` re-renders.
  const submittingRef = useRef(false)

  const log = useCallback(
    async (input: { metricId: string; date: string; value: number }): Promise<boolean> => {
      if (submittingRef.current) return false
      submittingRef.current = true
      setBusy(true)
      setError(null)
      try {
        await logMetricValue(supabase, userId, input)
        router.refresh()
        return true
      } catch {
        setError('Could not save this value. Please try again.')
        return false
      } finally {
        submittingRef.current = false
        setBusy(false)
      }
    },
    [supabase, userId, router]
  )

  const clearError = useCallback(() => setError(null), [])

  return { log, busy, error, clearError }
}

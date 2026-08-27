'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Check, Pause } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { awardFocusSessionXp, secondsLabel } from '@/lib/focus-session'
import { useUserStore } from '@/lib/stores/user-store'
import { pickFocusQuote } from '@/lib/focus-quotes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NatureBackdrop } from './NatureBackdrop'

const CONTROLS_VISIBLE_MS = 4000

export function FullscreenFocusTimer({ userId }: { userId: string }) {
  // Cast to the untyped client: `focus_sessions`' generated Update type
  // rejects this shape (see ProductivityHub.tsx, which does the same).
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const router = useRouter()
  const addXp = useUserStore((state) => state.addXp)
  const [session, setSession] = useState<FocusSessionRow | null>(null)
  const [endError, setEndError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  // A counter, not a boolean: re-setting a boolean to the value it already
  // holds does not change the effect's dependency, so the auto-hide timeout
  // was never rescheduled and the controls vanished four seconds after the
  // FIRST tap no matter how many times you tapped afterwards.
  const [interactions, setInteractions] = useState(0)
  const [ending, setEnding] = useState(false)
  const [quote] = useState(() => pickFocusQuote())

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    setSession((data as FocusSessionRow | null) ?? null)
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session])

  useEffect(() => {
    if (!loading && !session) router.replace('/admin/productivity')
  }, [loading, session, router])

  useEffect(() => {
    if (interactions === 0) return
    const timeout = window.setTimeout(() => setInteractions(0), CONTROLS_VISIBLE_MS)
    return () => window.clearTimeout(timeout)
  }, [interactions])

  // Installed as a PWA, manifest.json locks the whole app to portrait.
  // Free rotation just for this page (Chrome/Android only — Safari has no
  // orientation-lock API at all, so this is a no-op there), and restore the
  // app's normal portrait lock once the user leaves.
  useEffect(() => {
    // `lock()` was dropped from the standard ScreenOrientation type (it's a
    // non-standard Chromium-only extension), so TS doesn't know about it.
    type LockableOrientation = ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>
    }
    const orientation = (typeof screen !== 'undefined' ? screen.orientation : undefined) as
      | LockableOrientation
      | undefined
    if (!orientation || typeof orientation.unlock !== 'function') return
    try {
      orientation.unlock()
    } catch {
      // Unsupported, or called outside a user gesture — stays portrait-locked.
    }
    return () => {
      orientation.lock?.('portrait-primary').catch(() => {})
    }
  }, [])

  // Keep the screen on for the session — otherwise the OS dims/locks it
  // mid-focus-block. The browser silently releases the lock whenever the
  // tab/app is backgrounded (e.g. briefly switching apps), even though this
  // component never unmounts, so re-acquire on visibilitychange too.
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // Unsupported, denied, or low battery — the screen just times out normally.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !sentinel) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void sentinel?.release()
    }
  }, [])

  async function end(status: 'completed' | 'cancelled') {
    // Nothing else stops a second press landing while the write is in
    // flight, which would close the session twice and navigate twice.
    if (!session || ending) return
    setEnding(true)
    const actual = Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000))
    setEndError(null)
    const { error } = await supabase
      .from('focus_sessions')
      .update({ status, ended_at: new Date().toISOString(), actual_seconds: actual, updated_at: new Date().toISOString() })
      .eq('id', session.id)

    // Leaving for the hub on an unchecked failure would strand an active row,
    // and the partial unique index then blocks every future session on it.
    if (error) {
      setEndError('That session could not be closed. Check your connection and try again.')
      setEnding(false)
      return
    }

    if (status === 'completed') {
      try {
        const result = await awardFocusSessionXp(supabase, userId, { ...session, status, actual_seconds: actual })
        if (result.awarded) addXp(result.xpAwarded, result.previousTotal)
      } catch (xpError) {
        // A failed XP write must never cost the session it was paying for.
        console.error('Failed to award focus XP', xpError)
      }
    }

    router.push('/admin/productivity')
  }

  if (!session) return null

  const elapsed = Math.floor((now - new Date(session.started_at).getTime()) / 1000)
  const remaining = session.planned_minutes * 60 - elapsed

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden text-white"
      onClick={() => setInteractions((count) => count + 1)}
    >
      <NatureBackdrop />
      <div className="absolute inset-0 bg-black/35" />
      <div className="relative flex flex-col items-center px-6 text-center">
        <p className="select-none font-mono text-[min(20vw,32vh,9rem)] font-semibold tracking-[-0.08em] tabular-nums drop-shadow-lg">
          {secondsLabel(remaining)}
        </p>
        <p className="mt-4 max-w-sm text-sm text-white/75 drop-shadow">{quote}</p>
      </div>
      {endError && (
        <p
          role="alert"
          className="absolute bottom-[max(7rem,calc(env(safe-area-inset-bottom)+4rem))] max-w-xs px-6 text-center text-sm text-red-200 drop-shadow"
        >
          {endError}
        </p>
      )}
      <div
        className={cn(
          'absolute bottom-[max(3rem,env(safe-area-inset-bottom))] flex gap-3 transition-opacity duration-300',
          interactions > 0 ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <Button variant="secondary" disabled={ending} onClick={() => void end('completed')}>
          <Check /> Complete
        </Button>
        <Button
          variant="outline"
          className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          disabled={ending}
          onClick={() => void end('cancelled')}
        >
          <Pause /> Cancel
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Check, Pause } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { secondsLabel } from '@/lib/focus-session'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CONTROLS_VISIBLE_MS = 4000

export function FullscreenFocusTimer({ userId }: { userId: string }) {
  // Cast to the untyped client: `focus_sessions`' generated Update type
  // rejects this shape (see ProductivityHub.tsx, which does the same).
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const router = useRouter()
  const [session, setSession] = useState<FocusSessionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [controlsVisible, setControlsVisible] = useState(false)

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
    if (!controlsVisible) return
    const timeout = window.setTimeout(() => setControlsVisible(false), CONTROLS_VISIBLE_MS)
    return () => window.clearTimeout(timeout)
  }, [controlsVisible])

  async function end(status: 'completed' | 'cancelled') {
    if (!session) return
    const actual = Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000))
    await supabase
      .from('focus_sessions')
      .update({ status, ended_at: new Date().toISOString(), actual_seconds: actual, updated_at: new Date().toISOString() })
      .eq('id', session.id)
    router.push('/admin/productivity')
  }

  if (!session) return null

  const elapsed = Math.floor((now - new Date(session.started_at).getTime()) / 1000)
  const remaining = session.planned_minutes * 60 - elapsed

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-primary text-primary-foreground"
      onClick={() => setControlsVisible(true)}
    >
      <p className="select-none font-mono text-[min(22vw,10rem)] font-semibold tracking-[-0.08em] tabular-nums">
        {secondsLabel(remaining)}
      </p>
      <div
        className={cn(
          'absolute bottom-[max(3rem,env(safe-area-inset-bottom))] flex gap-3 transition-opacity duration-300',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <Button variant="secondary" onClick={() => void end('completed')}>
          <Check /> Complete
        </Button>
        <Button
          variant="outline"
          className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          onClick={() => void end('cancelled')}
        >
          <Pause /> Cancel
        </Button>
      </div>
    </div>
  )
}

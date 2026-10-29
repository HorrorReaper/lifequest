'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowLeft, Play, Timer } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { startFocusSession } from '@/lib/focus-session-actions'
import { NatureBackdrop } from '@/components/admin/NatureBackdrop'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function FocusTimerTool({
  initialSession,
  loadFailed = false,
}: {
  initialSession: FocusSessionRow | null
  loadFailed?: boolean
}) {
  const supabase = useMemo(
    () => createClient() as unknown as SupabaseClient,
    [],
  )
  const router = useRouter()
  const [duration, setDuration] = useState('25')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const minutes = Number(duration)
  const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 240

  async function start() {
    if (starting || !valid || loadFailed) return
    setStarting(true)
    setError(null)
    try {
      await startFocusSession(supabase, minutes)
      router.push('/learn/tools/focus-timer/run')
    } catch {
      setError(
        'Your session could not be started. Check your connection and try again.',
      )
      setStarting(false)
    }
  }

  return (
    <main className="min-h-svh bg-background p-4 pb-28 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/learn/tools"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Toolbox
        </Link>
        <header className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Timer className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Focus Timer
            </h1>
            <p className="text-sm text-muted-foreground">
              A little space for your most important work.
            </p>
          </div>
        </header>
        <section className="overflow-hidden rounded-[2rem] border bg-card">
          <div className="relative grid h-52 place-items-center overflow-hidden text-white sm:h-64">
            <NatureBackdrop />
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative px-6 text-center">
              <p className="font-mono text-6xl font-semibold tracking-[-0.08em] tabular-nums sm:text-7xl">
                {initialSession
                  ? `${initialSession.planned_minutes}:00`
                  : `${valid ? minutes : '—'}:00`}
              </p>
              <p className="mt-4 text-sm text-white/85">One thing at a time.</p>
            </div>
          </div>
          <div className="space-y-6 p-5 sm:p-7">
            {loadFailed ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-destructive">
                  Your focus session could not be loaded.
                </p>
                <Button variant="outline" onClick={() => router.refresh()}>
                  Try again
                </Button>
              </div>
            ) : initialSession ? (
              <>
                <div>
                  <h2 className="font-semibold">
                    Your session is still running
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Return to your timer to keep focusing or finish your
                    session.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => router.push('/learn/tools/focus-timer/run')}
                >
                  <Play /> Resume session
                </Button>
              </>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void start()
                }}
              >
                <fieldset disabled={starting} className="space-y-3">
                  <legend className="mb-3 text-sm font-medium">
                    How long would you like to focus?
                  </legend>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 25, 50].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={minutes === value ? 'default' : 'outline'}
                        aria-pressed={minutes === value}
                        onClick={() => setDuration(String(value))}
                        className="h-12"
                      >
                        {value} min
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="focus-minutes"
                      className="flex-1 text-sm text-muted-foreground"
                    >
                      Custom duration
                    </label>
                    <Input
                      id="focus-minutes"
                      className="w-24"
                      type="number"
                      min={1}
                      max={240}
                      step={1}
                      required
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose between 1 and 240 minutes.
                  </p>
                </fieldset>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full"
                  disabled={starting || !valid}
                >
                  <Play />
                  {starting ? 'Starting…' : 'Start focus session'}
                </Button>
              </form>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              A quiet nature scene, a countdown, and space to concentrate. Tap
              the timer to reveal Complete and Cancel. Completed sessions earn 1
              XP per full minute.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

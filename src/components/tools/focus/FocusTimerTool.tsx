'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, X } from 'lucide-react'
import { NatureBackdrop } from '@/components/admin/NatureBackdrop'
import { TaskCombobox } from '@/components/planning/TaskCombobox'
import type { TodayPlannerTask } from '@/components/planning/TodayPlanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { secondsLabel } from '@/lib/focus-session'
import { startCommittedFocusSession } from '@/lib/focus-session-actions'
import { createClient } from '@/lib/supabase/client'

const MAX_TASKS = 3

export function FocusTimerTool({
  tasks,
  loadFailed = false,
}: {
  tasks: TodayPlannerTask[]
  loadFailed?: boolean
}) {
  const router = useRouter()
  const [duration, setDuration] = useState('25')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const minutes = Number(duration)
  const validDuration =
    Number.isInteger(minutes) && minutes >= 1 && minutes <= 240
  const selected = selectedIds.flatMap((id) => {
    const task = tasks.find((item) => item.id === id)
    return task ? [task] : []
  })
  const available = tasks.filter((task) => !selectedIds.includes(task.id))
  const canStart =
    validDuration && selected.length > 0 && selected.length <= MAX_TASKS

  async function start() {
    if (starting || !canStart || loadFailed) return
    setStarting(true)
    setError(null)
    try {
      await startCommittedFocusSession(
        createClient(),
        minutes,
        selected.map((task) => task.id),
      )
      router.refresh()
    } catch (startError) {
      setError(
        typeof startError === 'object' &&
          startError &&
          'code' in startError &&
          startError.code === '42501'
          ? 'One of those tasks is no longer available. Choose another task.'
          : 'Your session could not be started. Try again.',
      )
      setStarting(false)
    }
  }

  return (
    <main className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <NatureBackdrop />
        <div className="absolute inset-0 bg-black/40" />
      </div>
      <div className="relative mx-auto flex min-h-full max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link
          href="/learn/tools"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-white hover:bg-white/10"
        >
          <ArrowLeft className="size-4" /> Toolbox
        </Link>
        <div className="my-auto py-5">
          <header className="mb-5 text-center text-white">
            <h1 className="text-lg font-semibold">Focus Timer</h1>
            <p
              aria-hidden="true"
              className="font-mono text-6xl font-semibold tracking-tight tabular-nums drop-shadow sm:text-7xl"
            >
              {validDuration ? secondsLabel(minutes * 60) : '—:—'}
            </p>
          </header>
          {loadFailed ? (
            <div className="space-y-3 rounded-2xl border bg-card p-5 text-card-foreground">
              <p role="alert">Your focus session could not be loaded.</p>
              <Button variant="outline" onClick={() => router.refresh()}>
                Try again
              </Button>
            </div>
          ) : (
            <form
              className="rounded-2xl border bg-card p-5 text-card-foreground shadow-lg sm:p-6"
              onSubmit={(event) => {
                event.preventDefault()
                void start()
              }}
            >
              <fieldset disabled={starting} className="space-y-5">
                <section
                  aria-labelledby="focus-tasks-heading"
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 id="focus-tasks-heading" className="font-semibold">
                      Commit to this block
                    </h2>
                    <span
                      aria-live="polite"
                      className="text-sm tabular-nums text-muted-foreground"
                    >
                      {selected.length} / {MAX_TASKS}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Pick one to three of your open tasks.
                  </p>
                  {selected.length > 0 && (
                    <ol className="space-y-1.5">
                      {selected.map((task, index) => (
                        <li
                          key={task.id}
                          className="flex items-center gap-2 rounded-lg bg-muted/60 pl-3"
                        >
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {index + 1}.
                          </span>
                          <span className="min-w-0 flex-1 break-words py-2 text-sm">
                            {task.title}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${task.title}`}
                            onClick={() =>
                              setSelectedIds((ids) =>
                                ids.filter((id) => id !== task.id),
                              )
                            }
                          >
                            <X />
                          </Button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {selected.length < MAX_TASKS && available.length > 0 && (
                    <TaskCombobox
                      ariaLabel="Search open tasks"
                      placeholder="Search open tasks"
                      tasks={available}
                      linkedTaskId={null}
                      value={query}
                      onChangeText={setQuery}
                      onSelectTask={(task) => {
                        setSelectedIds((ids) =>
                          ids.length < MAX_TASKS && !ids.includes(task.id)
                            ? [...ids, task.id]
                            : ids,
                        )
                        setQuery('')
                      }}
                    />
                  )}
                  {tasks.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      You have no open tasks. Add one in{' '}
                      <Link
                        href="/tasks"
                        className="font-medium text-primary underline underline-offset-4"
                      >
                        Tasks
                      </Link>
                      .
                    </p>
                  )}
                </section>
                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm font-medium">Focus duration</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 25, 50].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={minutes === value ? 'default' : 'outline'}
                        aria-pressed={minutes === value}
                        onClick={() => setDuration(String(value))}
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
                      type="number"
                      min={1}
                      max={240}
                      step={1}
                      required
                      value={duration}
                      onChange={(event) => setDuration(event.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full"
                  disabled={starting || !canStart}
                >
                  <Play />
                  {starting ? 'Starting…' : 'Commit and start'}
                </Button>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

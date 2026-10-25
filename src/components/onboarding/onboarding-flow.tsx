'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  Loader2Icon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseFrom } from '@/lib/supabase/helpers'
import { fetchCityState } from '@/lib/city/city'
import { createTask, updateTask } from '@/lib/tasks'
import { fetchDayPlan, upsertDayPlan } from '@/lib/day-plans'
import { dateInTimezone } from '@/lib/dates'
import {
  buildOnboardingPlan,
  DEFAULT_ONBOARDING_DURATION,
  ONBOARDING_DURATIONS,
  ONBOARDING_FOCUS,
  onboardingEndTime,
  suggestedStartTime,
  type OnboardingFocusId,
} from '@/lib/onboarding'
import {
  detectTimezone,
  formatTimezoneLabel,
  groupedTimezoneOptions,
} from '@/lib/timezones'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface OnboardingFlowProps {
  userId: string
  currentName: string
}

/**
 * Where the first task's id is kept between steps, for this tab only.
 *
 * Going back to change the title, reloading, or pressing Continue twice must
 * reuse the task already saved rather than create a second one.
 */
function draftKey(userId: string) {
  return `lifequest:onboarding:${userId}`
}

interface StoredDraft {
  taskId: string
  title: string
}

function readDraft(userId: string): StoredDraft | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(userId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredDraft>
    return typeof value.taskId === 'string' && typeof value.title === 'string'
      ? { taskId: value.taskId, title: value.title }
      : null
  } catch {
    return null
  }
}

function writeDraft(userId: string, draft: StoredDraft | null) {
  try {
    if (draft) window.sessionStorage.setItem(draftKey(userId), JSON.stringify(draft))
    else window.sessionStorage.removeItem(draftKey(userId))
  } catch {
    // Storage can be unavailable (private mode); the in-memory id still
    // protects against duplicates for as long as the page is open.
  }
}

function minutesNowIn(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hours * 60 + minutes
}

function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-balance text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">
        {title}
      </h1>
      {description && (
        <p className="text-pretty text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

const STEP_LABELS = ['Your focus', 'First task', 'Plan it for today']

export function OnboardingFlow({ userId, currentName }: OnboardingFlowProps) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const reduceMotion = useReducedMotion()

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [name, setName] = useState(currentName)
  const [editingName, setEditingName] = useState(!currentName.trim())
  const [timezone, setTimezone] = useState(detectTimezone)
  const [editingTimezone, setEditingTimezone] = useState(false)
  const [focus, setFocus] = useState<OnboardingFocusId | null>(null)
  const [title, setTitle] = useState('')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [savedTitle, setSavedTitle] = useState<string | null>(null)
  const [start, setStart] = useState(() => suggestedStartTime(minutesNowIn(detectTimezone())))
  const [duration, setDuration] = useState<number>(DEFAULT_ONBOARDING_DURATION)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ field: 'name' | 'title' | 'start' | null; message: string } | null>(null)
  // Set synchronously, before any await, so a double tap cannot start a
  // second save while the first is still running.
  const busy = useRef(false)

  // A reload in the middle of the flow picks the saved task back up.
  useEffect(() => {
    const draft = readDraft(userId)
    if (!draft) return
    queueMicrotask(() => {
      setTaskId(draft.taskId)
      setSavedTitle(draft.title)
      setTitle(draft.title)
    })
  }, [userId])

  const timezoneGroups = useMemo(() => groupedTimezoneOptions(timezone), [timezone])
  const suggestions = ONBOARDING_FOCUS.find((option) => option.id === focus)?.suggestions ?? []
  const end = onboardingEndTime(start, duration)

  function goToStep(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
    setError(null)
  }

  const stepVariants = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 24 : -24 }),
        center: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -24 : 24 }),
      }

  /** Step 2 -> 3: saves the task, or updates the one saved before. */
  async function saveTask() {
    const trimmed = title.trim()
    if (!trimmed) {
      setError({ field: 'title', message: 'Write down one small thing you want to get done.' })
      return
    }
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError(null)
    try {
      const today = dateInTimezone(new Date(), timezone)
      let id = taskId
      if (id && trimmed !== savedTitle) {
        try {
          await updateTask(supabase, id, { title: trimmed, due_date: today })
        } catch (updateError) {
          // The remembered task is gone (deleted in another tab): start over
          // with a new one instead of failing on every retry.
          if ((updateError as { code?: string } | null)?.code !== 'PGRST116') throw updateError
          id = null
        }
      }
      if (!id) {
        const created = await createTask(supabase, userId, {
          title: trimmed,
          due_date: today,
          priority: 'high',
        })
        id = created.id
        setTaskId(id)
      }
      writeDraft(userId, { taskId: id, title: trimmed })
      setSavedTitle(trimmed)
      setStart(suggestedStartTime(minutesNowIn(timezone)))
      goToStep(2)
    } catch (saveError) {
      console.error('Onboarding task save failed:', saveError)
      setError({
        field: 'title',
        message: 'Your task was not saved. Check your connection and try again.',
      })
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  /** Step 3: plans the task into today and finishes onboarding. */
  async function finish() {
    if (!taskId || !savedTitle) return
    if (!end || end <= start) {
      setError({ field: 'start', message: 'Pick a start time that leaves room before midnight.' })
      return
    }
    if (!name.trim()) {
      setError({ field: 'name', message: 'Add the name we should greet you with.' })
      return
    }
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError(null)

    try {
      const today = dateInTimezone(new Date(), timezone)
      const existing = await fetchDayPlan(supabase, userId, today)
      const plan = buildOnboardingPlan({
        existingBlocks: existing?.blocks ?? [],
        existingNotes: existing?.notes ?? null,
        taskId,
        title: savedTitle,
        start,
        end,
      })
      await upsertDayPlan(supabase, userId, { plan_date: today, ...plan })

      // Upsert rather than update: the profile row is created only by the
      // auth callback, so a sign-up that never passed through it would
      // update zero rows without erroring and loop back here forever.
      const { data, error: saveError } = await supabaseFrom(supabase, 'profiles')
        .upsert(
          {
            id: userId,
            username: name.trim(),
            timezone,
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('id')

      if (saveError) throw saveError
      if (!data || data.length === 0) {
        throw new Error('Profile was not written during onboarding')
      }

      // Seeding the city is a convenience; it is created lazily elsewhere.
      // A failure here must not report a finished onboarding as failed.
      try {
        await fetchCityState(supabase, userId)
      } catch (cityError) {
        console.error('City bootstrap failed after onboarding:', cityError)
      }

      writeDraft(userId, null)
      router.push('/dashboard?welcome=1')
    } catch (finishError) {
      console.error('Onboarding error:', finishError)
      setError({
        field: null,
        message: 'Your plan was not saved yet. Your task is safe -- try again.',
      })
      busy.current = false
      setSaving(false)
    }
  }

  const steps = [
    <div key="focus" className="space-y-8">
      <StepHeading
        title="Bring clarity to your day."
        description="LifeQuest helps you pick what matters today, plan it, and keep small daily habits. Three quick steps and your first task is planned."
      />

      <div className="space-y-2">
        {editingName ? (
          <>
            <Label htmlFor="name">What should we call you?</Label>
            <Input
              id="name"
              placeholder="Alex"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={50}
              aria-invalid={error?.field === 'name' || undefined}
              aria-describedby={error?.field === 'name' ? 'onboarding-name-error' : undefined}
              className="h-12 text-base"
            />
            {error?.field === 'name' && (
              <p id="onboarding-name-error" className="text-sm text-destructive">
                {error.message}
              </p>
            )}
          </>
        ) : (
          <p className="text-base">
            Hi {name.trim()}.{' '}
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            >
              Change name
            </button>
          </p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-medium">
          Where do you want more clarity right now?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ONBOARDING_FOCUS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={focus === option.id}
              onClick={() => setFocus(option.id)}
              className={cn(
                'min-h-12 rounded-xl border bg-card px-4 text-left text-base transition-colors',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                focus === option.id
                  ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary/30'
                  : 'hover:border-primary/40'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Only used to suggest a first task. You can skip it.
        </p>
      </fieldset>

      <div className="text-sm text-muted-foreground">
        {editingTimezone ? (
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-foreground">
              Timezone
            </Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="flex h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {timezoneGroups.map((group) => (
                <optgroup key={group.region} label={group.region}>
                  {group.zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {formatTimezoneLabel(zone)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p>Decides which day your tasks, habits and plans belong to.</p>
          </div>
        ) : (
          <p>
            Times use {formatTimezoneLabel(timezone)}.{' '}
            <button
              type="button"
              onClick={() => setEditingTimezone(true)}
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            >
              Change timezone
            </button>
          </p>
        )}
      </div>
    </div>,

    <div key="task" className="space-y-8">
      <StepHeading
        title="What is one small thing you want to get done today?"
        description="Make it concrete enough to finish in one sitting. It becomes a real task you can edit later."
      />

      <div className="space-y-2">
        <Label htmlFor="first-task">Your first task</Label>
        <Input
          id="first-task"
          placeholder="e.g. Reply to the email I keep putting off"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (error?.field === 'title') setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void saveTask()
            }
          }}
          maxLength={160}
          autoFocus
          disabled={saving}
          aria-invalid={error?.field === 'title' || undefined}
          aria-describedby={error?.field === 'title' ? 'first-task-error' : undefined}
          className="h-12 text-base"
        />
        {error?.field === 'title' && (
          <p id="first-task-error" role="alert" className="text-sm text-destructive">
            {error.message}
          </p>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Or start from an idea</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setTitle(suggestion)
                  setError(null)
                }}
                className="min-h-11 rounded-full border bg-card px-4 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,

    <div key="schedule" className="space-y-8">
      <StepHeading
        title="When will you do it today?"
        description="A short block in today's plan. You can move it later on the timeline."
      />

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Your task</p>
        <p className="mt-1 text-base font-medium break-words">{savedTitle}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="first-block-start">Start</Label>
          <Input
            id="first-block-start"
            type="time"
            value={start}
            onChange={(event) => {
              setStart(event.target.value)
              if (error?.field === 'start') setError(null)
            }}
            aria-invalid={error?.field === 'start' || undefined}
            aria-describedby={error?.field === 'start' ? 'first-block-error' : undefined}
            className="h-12 text-base"
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Length</legend>
          <div className="grid grid-cols-4 gap-2">
            {ONBOARDING_DURATIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={duration === minutes}
                onClick={() => setDuration(minutes)}
                className={cn(
                  'min-h-12 rounded-xl border bg-card text-base transition-colors',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  duration === minutes
                    ? 'border-primary bg-primary/10 font-medium ring-1 ring-primary/30'
                    : 'hover:border-primary/40'
                )}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {error?.field === 'start' ? (
        <p id="first-block-error" role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : (
        end && (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <CalendarCheckIcon className="size-4 text-primary" aria-hidden="true" />
            Today, {start} – {end}
          </p>
        )
      )}
    </div>,
  ]

  const isLastStep = step === steps.length - 1

  async function handlePrimary() {
    if (step === 0) {
      if (!name.trim()) {
        setEditingName(true)
        setError({ field: 'name', message: 'Add the name we should greet you with.' })
        return
      }
      goToStep(1)
      return
    }
    if (step === 1) {
      await saveTask()
      return
    }
    await finish()
  }

  return (
    <div className="flex min-h-svh w-full max-w-xl flex-col px-1 py-8">
      <div className="mb-10 space-y-2">
        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span>{STEP_LABELS[step]}</span>
          <span className="tabular-nums">
            Step {step + 1} of {steps.length}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </div>

      <div className="flex flex-1 items-start">
        <div className="w-full">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>

          {error && error.field === null && (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {error.message}
            </p>
          )}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => goToStep(step - 1)}
          disabled={step === 0 || saving}
          className="h-12"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={() => void handlePrimary()}
          disabled={saving || (step === 1 && !title.trim())}
          className="h-12 flex-1"
        >
          {saving ? (
            <>
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
              Saving…
            </>
          ) : isLastStep ? (
            <>
              Plan it and finish
              <ArrowRightIcon data-icon="inline-end" />
            </>
          ) : step === 1 ? (
            <>
              Save task
              <ArrowRightIcon data-icon="inline-end" />
            </>
          ) : (
            <>
              Continue
              <ArrowRightIcon data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

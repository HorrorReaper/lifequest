'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronRightIcon,
  FlameIcon,
  Loader2Icon,
  MoonIcon,
  NotebookPenIcon,
  PenLineIcon,
  SunIcon,
  TrendingUpIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseFrom } from '@/lib/supabase/helpers'
import { fetchCityState } from '@/lib/city/city'
import { createGoal } from '@/lib/goals'
import { enablePush, pushSupport, vapidPublicKey } from '@/lib/push-client'
import type { ReminderKind } from '@/lib/push-subscription'
import {
  birthYearFromAge,
  isValidAge,
  MAX_AGE,
  MIN_AGE,
  ONBOARDING_GOAL_AREAS,
  ONBOARDING_STEPS,
  questionSteps,
  sceneStageFor,
  startOptions,
  type OnboardingStep,
  type OnboardingTemplate,
  type StartOption,
} from '@/lib/onboarding'
import {
  detectTimezone,
  formatTimezoneLabel,
  groupedTimezoneOptions,
} from '@/lib/timezones'
import { WEEKLY_PLAN_TEMPLATE_ID } from '@/lib/weekly-rituals'
import type { GoalCategory } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { OnboardingScene } from '@/components/onboarding/OnboardingScene'

interface OnboardingFlowProps {
  userId: string
  currentName: string
  /** Active system journal templates, offered as a first step. */
  templates: OnboardingTemplate[]
  /** When each reminder goes out ("08:00"), or null where it is not offered. */
  reminderTimes: Record<ReminderKind, string | null>
}

type FieldError = { field: 'name' | 'age' | 'goal' | 'start'; message: string } | null

/** The scene's height and the avatar's on each step, in px. */
const SCENE: Record<OnboardingStep, { height: number; avatar: number }> = {
  welcome: { height: 440, avatar: 136 },
  name: { height: 280, avatar: 104 },
  age: { height: 280, avatar: 104 },
  goal: { height: 260, avatar: 100 },
  reminders: { height: 280, avatar: 104 },
  start: { height: 200, avatar: 88 },
  done: { height: 400, avatar: 128 },
}

const REMINDERS: Array<{ kind: ReminderKind; label: string; icon: LucideIcon; tint: string }> = [
  {
    kind: 'daily_plan',
    label: 'Plan your day',
    icon: SunIcon,
    tint: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  },
  {
    kind: 'evening_review',
    label: 'Evening review',
    icon: MoonIcon,
    tint: 'bg-indigo-500/12 text-indigo-800 dark:text-indigo-200',
  },
]

/** An icon and tint for each way to start, so the list reads at a glance. */
function optionLook(option: StartOption): { icon: LucideIcon; tint: string } {
  if (option.kind === 'plan') return { icon: CalendarClockIcon, tint: 'bg-primary/12 text-primary' }
  if (option.id === WEEKLY_PLAN_TEMPLATE_ID) {
    return { icon: CalendarRangeIcon, tint: 'bg-lime-600/12 text-lime-800 dark:text-lime-200' }
  }
  switch (option.entryType) {
    case 'morning':
      return { icon: SunIcon, tint: 'bg-amber-500/15 text-amber-800 dark:text-amber-200' }
    case 'evening':
      return { icon: MoonIcon, tint: 'bg-indigo-500/12 text-indigo-800 dark:text-indigo-200' }
    case 'free_write':
      return { icon: PenLineIcon, tint: 'bg-fuchsia-500/12 text-fuchsia-800 dark:text-fuchsia-200' }
    case 'weekly':
      return { icon: TrendingUpIcon, tint: 'bg-primary/12 text-primary' }
    case 'custom':
      return { icon: ZapIcon, tint: 'bg-rose-500/12 text-rose-800 dark:text-rose-200' }
    default:
      return { icon: NotebookPenIcon, tint: 'bg-muted text-foreground' }
  }
}

function StepTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-balance text-[1.75rem] leading-tight font-bold tracking-tight sm:text-3xl">
        {children}
      </h1>
      {hint && <p className="text-base leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * The first-run flow (docs/features/core-app.md#onboarding). One question
 * per screen under the trail scene from the dashboard, which grows with the
 * answers while the avatar walks along and greets the user by name. It ends
 * on the first step of the day, the daily plan or a journal entry, either of
 * which starts the streak.
 */
export function OnboardingFlow({ userId, currentName, templates, reminderTimes }: OnboardingFlowProps) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const reduceMotion = useReducedMotion()

  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState(currentName)
  const [timezone, setTimezone] = useState(detectTimezone)
  const [editingTimezone, setEditingTimezone] = useState(false)
  const [age, setAge] = useState('')
  const [category, setCategory] = useState<GoalCategory>('health')
  const [goal, setGoal] = useState('')
  const offeredReminders = REMINDERS.filter((reminder) => reminderTimes[reminder.kind] !== null)
  const [reminders, setReminders] = useState<Record<ReminderKind, boolean>>({
    daily_plan: true,
    evening_review: true,
  })
  // Only known in the browser: push needs a service worker, the Push API and
  // a VAPID key, and on iPhone an installed home-screen app.
  const [pushReady, setPushReady] = useState(false)
  const [chosen, setChosen] = useState<StartOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<FieldError>(null)
  // Set before any await, so a double tap cannot start a second save.
  const busy = useRef(false)
  // A goal saved by an earlier attempt is not saved twice on a retry.
  const goalSaved = useRef(false)

  useEffect(() => {
    queueMicrotask(() => setPushReady(pushSupport() === 'supported' && vapidPublicKey() !== null))
  }, [])

  const withReminders = pushReady && offeredReminders.length > 0
  const steps = useMemo(
    () => ONBOARDING_STEPS.filter((item) => withReminders || item !== 'reminders'),
    [withReminders]
  )
  const questions = questionSteps(withReminders)
  const questionIndex = questions.indexOf(step)
  const options = useMemo(() => startOptions(templates), [templates])
  const timezoneGroups = useMemo(() => groupedTimezoneOptions(timezone), [timezone])
  const firstName = name.trim().split(/\s+/)[0] ?? ''
  const area = ONBOARDING_GOAL_AREAS.find((item) => item.category === category) ?? ONBOARDING_GOAL_AREAS[0]

  function goTo(next: OnboardingStep) {
    setDirection(steps.indexOf(next) >= steps.indexOf(step) ? 1 : -1)
    setStep(next)
    setError(null)
  }

  function nextStep() {
    const index = steps.indexOf(step)
    goTo(steps[Math.min(index + 1, steps.length - 1)])
  }

  function back() {
    const index = steps.indexOf(step)
    if (index > 0) goTo(steps[index - 1])
  }

  /** Asks for permission (from this tap) and subscribes each chosen reminder. */
  async function saveReminders() {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    try {
      for (const reminder of offeredReminders) {
        if (!reminders[reminder.kind]) continue
        const result = await enablePush(reminder.kind)
        // Denied or failed: onboarding goes on; Settings can turn it on later.
        if (!result.ok) break
      }
    } finally {
      busy.current = false
      setSaving(false)
      nextStep()
    }
  }

  async function handlePrimary() {
    if (step === 'welcome') return nextStep()
    if (step === 'name') {
      if (!name.trim()) return setError({ field: 'name', message: 'Add the name we should greet you with.' })
      return nextStep()
    }
    if (step === 'age') {
      if (!isValidAge(age)) {
        return setError({ field: 'age', message: `Enter an age between ${MIN_AGE} and ${MAX_AGE}.` })
      }
      return nextStep()
    }
    if (step === 'goal') {
      if (!goal.trim()) return setError({ field: 'goal', message: 'Write down one thing you want to improve.' })
      return nextStep()
    }
    if (step === 'reminders') return saveReminders()
    if (step === 'done' && chosen) router.push(chosen.href)
  }

  /** The last question: saves everything and shows the first day. */
  async function start(option: StartOption) {
    if (busy.current) return
    busy.current = true
    setSaving(true)
    setError(null)
    try {
      // Before the profile, so a failure here can be retried without having
      // already marked onboarding complete and lost the goal.
      if (!goalSaved.current) {
        await createGoal(supabase, userId, { title: goal, category })
        goalSaved.current = true
      }

      // Upsert rather than update: the profile row is created only by the
      // auth callback, so a sign-up that never passed through it would update
      // zero rows without erroring and loop back here forever.
      const { data, error: saveError } = await supabaseFrom(supabase, 'profiles')
        .upsert(
          {
            id: userId,
            username: name.trim(),
            timezone,
            birth_year: birthYearFromAge(Number(age)),
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('id')
      if (saveError) throw saveError
      if (!data || data.length === 0) throw new Error('Profile was not written during onboarding')

      // Seeding the city is a convenience; it is created lazily elsewhere.
      try {
        await fetchCityState(supabase, userId)
      } catch (cityError) {
        console.error('City bootstrap failed after onboarding:', cityError)
      }

      setChosen(option)
      goTo('done')
    } catch (startError) {
      console.error('Onboarding error:', startError)
      setError({ field: 'start', message: 'Your answers were not saved. Check your connection and try again.' })
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  const variants = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (dir: number) => ({ opacity: 0, y: 14, x: dir * 12 }),
        center: { opacity: 1, y: 0, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir * -12 }),
      }

  const fieldError = (field: NonNullable<FieldError>['field'], id: string) =>
    error?.field === field ? (
      <p id={id} role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    ) : null

  const content: Record<OnboardingStep, React.ReactNode> = {
    welcome: (
      <StepTitle hint="Plan your day, look back on it, and watch your trail grow.">
        Build your life like an adventure.
      </StepTitle>
    ),

    name: (
      <div className="space-y-6">
        <StepTitle>What is your name?</StepTitle>
        <div className="space-y-2">
          <Label htmlFor="onboarding-name">Your name</Label>
          <Input
            id="onboarding-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (error?.field === 'name') setError(null)
            }}
            placeholder="Alex"
            maxLength={50}
            autoComplete="given-name"
            aria-invalid={error?.field === 'name' || undefined}
            aria-describedby={error?.field === 'name' ? 'onboarding-name-error' : undefined}
            className="h-14 rounded-2xl text-lg sm:h-14 md:text-lg"
          />
          {fieldError('name', 'onboarding-name-error')}
        </div>
        {editingTimezone ? (
          <div className="space-y-2">
            <Label htmlFor="onboarding-timezone">Timezone</Label>
            <select
              id="onboarding-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="flex h-12 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
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
    ),

    age: (
      <div className="space-y-6">
        <StepTitle hint="Nobody else sees it.">How old are you?</StepTitle>
        <div className="flex flex-col items-center gap-2 text-center">
          <Label htmlFor="onboarding-age" className="sr-only">
            Your age
          </Label>
          <Input
            id="onboarding-age"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="28"
            value={age}
            onChange={(event) => {
              setAge(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
              if (error?.field === 'age') setError(null)
            }}
            aria-invalid={error?.field === 'age' || undefined}
            aria-describedby={error?.field === 'age' ? 'onboarding-age-error' : undefined}
            className="h-20 w-36 rounded-2xl text-center text-4xl font-bold sm:h-20 md:text-4xl"
          />
          {fieldError('age', 'onboarding-age-error')}
        </div>
      </div>
    ),

    goal: (
      <div className="space-y-5">
        <StepTitle hint="It becomes your first goal.">What do you want to improve?</StepTitle>
        <div role="group" aria-label="Area" className="flex flex-wrap gap-2">
          {ONBOARDING_GOAL_AREAS.map((item) => {
            const on = item.category === category
            return (
              <button
                key={item.category}
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(item.category)}
                className={cn(
                  'min-h-11 rounded-full border px-4 text-[15px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  on
                    ? 'border-primary bg-primary font-semibold text-primary-foreground'
                    : 'bg-card font-medium hover:border-primary/40'
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-goal">Your goal</Label>
          <Input
            id="onboarding-goal"
            value={goal}
            onChange={(event) => {
              setGoal(event.target.value)
              if (error?.field === 'goal') setError(null)
            }}
            placeholder={area.example}
            maxLength={120}
            aria-invalid={error?.field === 'goal' || undefined}
            aria-describedby={error?.field === 'goal' ? 'onboarding-goal-error' : undefined}
            className="h-14 rounded-2xl text-base sm:h-14 md:text-base"
          />
          {fieldError('goal', 'onboarding-goal-error')}
        </div>
      </div>
    ),

    reminders: (
      <div className="space-y-5">
        <StepTitle>Should we remind you?</StepTitle>
        <div className="space-y-2.5">
          {offeredReminders.map(({ kind, label, icon: Icon, tint }) => {
            const id = `onboarding-reminder-${kind}`
            return (
              <div key={kind} className="flex items-center gap-3.5 rounded-2xl border bg-card p-4">
                <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tint)}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor={id} className="text-base font-semibold">
                    {label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{reminderTimes[kind]}</p>
                </div>
                <Switch
                  id={id}
                  checked={reminders[kind]}
                  onCheckedChange={(next) => setReminders((current) => ({ ...current, [kind]: next }))}
                />
              </div>
            )
          })}
        </div>
      </div>
    ),

    start: (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <StepTitle>How do you want to start today?</StepTitle>
        {fieldError('start', 'onboarding-start-error')}
        <div role="group" aria-label="First step" className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-2">
          {options.map((option) => {
            const { icon: Icon, tint } = optionLook(option)
            return (
              <button
                key={option.id}
                type="button"
                disabled={saving}
                onClick={() => void start(option)}
                className={cn(
                  'flex min-h-16 w-full shrink-0 items-center gap-3.5 rounded-2xl border bg-card px-3.5 py-3 text-left transition',
                  'hover:-translate-y-px hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60'
                )}
              >
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', tint)}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold">{option.title}</span>
                    <span className="text-xs font-semibold text-primary">
                      {option.kind === 'plan' ? 'Daily plan' : `+${option.xpReward} XP`}
                    </span>
                  </span>
                  {option.detail && (
                    <span className="block text-sm leading-snug text-muted-foreground">{option.detail}</span>
                  )}
                </span>
                {saving ? (
                  <Loader2Icon className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    ),

    done: (
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.15 }}
          className="-mt-20 flex size-24 flex-col items-center justify-center rounded-full border-4 border-background bg-orange-100 text-orange-700 shadow-lg dark:bg-orange-950 dark:text-orange-300"
        >
          <FlameIcon className="size-9 motion-safe:animate-pulse" aria-hidden="true" />
          <span className="text-xs font-bold">Day 1</span>
        </motion.div>
        <h1 className="text-balance text-[1.75rem] leading-tight font-bold tracking-tight">
          {firstName ? `${firstName}, your streak starts today.` : 'Your streak starts today.'}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {chosen?.kind === 'template'
            ? `Finishing your ${chosen.title} counts as day one.`
            : 'Saving today’s plan counts as day one.'}
        </p>
      </div>
    ),
  }

  const primaryLabel =
    step === 'welcome'
      ? 'Start the adventure'
      : step === 'done'
        ? chosen?.kind === 'template'
          ? 'Start writing'
          : 'Open the planner'
        : 'Continue'
  const scene = SCENE[step]
  const showGreeting = step !== 'welcome' && step !== 'done' && firstName.length > 0

  return (
    <div className="flex min-h-svh w-full max-w-md flex-col overflow-hidden bg-background sm:min-h-[min(860px,calc(100svh-4rem))] sm:rounded-[2rem] sm:border sm:shadow-xl">
      <OnboardingScene
        stage={sceneStageFor(step)}
        height={scene.height}
        avatarHeight={scene.avatar}
        greeting={showGreeting ? `Hey ${firstName}!` : null}
      >
        {questionIndex >= 0 && (
          <div className="absolute inset-x-4 top-4 z-30 flex items-center gap-2.5">
            <button
              type="button"
              onClick={back}
              disabled={saving}
              aria-label="Back"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card/85 text-foreground shadow-sm backdrop-blur focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ArrowLeftIcon className="size-5" aria-hidden="true" />
            </button>
            <div className="flex h-11 flex-1 items-center gap-3 rounded-full bg-card/85 px-4 shadow-sm backdrop-blur">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
              <span aria-hidden="true" className="text-sm font-semibold tabular-nums text-muted-foreground">
                {questionIndex + 1} / {questions.length}
              </span>
              <span className="sr-only">
                Step {questionIndex + 1} of {questions.length}
              </span>
            </div>
          </div>
        )}
      </OnboardingScene>

      <div className="relative z-10 -mt-5 flex flex-1 flex-col rounded-t-[1.75rem] bg-background px-6 pt-7 pb-[calc(1.5rem+var(--safe-area-bottom,0px))] shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
        <div className="flex min-h-0 flex-1 flex-col">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {content[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {step !== 'start' && (
          <Button
            type="button"
            size="lg"
            onClick={() => void handlePrimary()}
            disabled={saving}
            className="mt-6 h-14 w-full rounded-2xl text-base font-semibold shadow-md sm:h-14"
          >
            {saving ? (
              <>
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                {primaryLabel}
                <ArrowRightIcon data-icon="inline-end" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

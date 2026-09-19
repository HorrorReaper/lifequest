'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  Loader2Icon,
  PencilLineIcon,
  ZapIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseFrom } from '@/lib/supabase/helpers'
import { fetchCityState } from '@/lib/city/city'
import { createGoal, GOAL_CATEGORIES } from '@/lib/goals'
import type { GoalCategory } from '@/lib/types'
import {
  detectTimezone,
  formatTimezoneLabel,
  groupedTimezoneOptions,
} from '@/lib/timezones'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Template {
  id: string
  name: string
  description: string | null
  icon: string
  entry_type: string
  xp_reward: number
}

interface OnboardingFlowProps {
  userId: string
  currentName: string
  templates: Template[]
}

/**
 * The range an age is accepted in.
 *
 * The floor is the usual minimum age for an account rather than anything
 * this app enforces elsewhere; move it if the product decides otherwise.
 */
const MIN_AGE = 13
const MAX_AGE = 120

/** Which goal categories to offer, and in what order. */
const GOAL_CATEGORY_ORDER: GoalCategory[] = [
  'health',
  'career',
  'learning',
  'relationships',
  'personal',
  'finance',
  'other',
]

/**
 * The year someone was born, from the age they gave.
 *
 * Off by one for anyone whose birthday has not passed yet this year, which
 * is why the column is documented as approximate. A year that stays right
 * within twelve months beats an age that is wrong from the next birthday on.
 */
export function birthYearFromAge(age: number, today = new Date()): number {
  return today.getFullYear() - age
}

export function isValidAge(value: string): boolean {
  if (!/^\d{1,3}$/.test(value.trim())) return false
  const age = Number(value)
  return age >= MIN_AGE && age <= MAX_AGE
}

function Question({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="text-pretty leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}

export function OnboardingFlow({
  userId,
  currentName,
  templates,
}: OnboardingFlowProps) {
  const router = useRouter()
  const supabase = createClient()
  const reduceMotion = useReducedMotion()

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [name, setName] = useState(currentName)
  const [timezone, setTimezone] = useState(detectTimezone)
  const [age, setAge] = useState('')
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('health')
  const [goalTitle, setGoalTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timezoneGroups = groupedTimezoneOptions(timezone)

  function goToStep(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const stepVariants = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 24 : -24 }),
        center: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -24 : 24 }),
      }

  const stepLabels = ['Welcome', 'You', 'Age', 'Goal', 'First entry']

  const steps = [
    <div key="welcome" className="space-y-8">
      <Question
        title="Build your life like a city."
        description="Reflect, plan, and finish small things. LifeQuest turns them into visible progress."
      />
      <p className="text-sm text-muted-foreground">
        Four short questions and you are in.
      </p>
    </div>,

    <div key="you" className="space-y-8">
      <Question title="What should we call you?" />

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="Alex"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
            autoFocus
            className="h-14 text-lg"
          />
        </div>

        {/* Pre-filled from the browser, so this reads as a confirmation
            rather than a second question. It decides which day every streak,
            habit and plan belongs to, which is why it is not hidden away. */}
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="flex h-12 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
          <p className="text-xs text-muted-foreground">
            Decides which day your entries and streaks land on.
          </p>
        </div>
      </div>
    </div>,

    <div key="age" className="space-y-8">
      <Question
        title="How old are you?"
        description="It helps shape what LifeQuest suggests. Nobody else sees it."
      />

      <div className="space-y-2">
        <Label htmlFor="age" className="sr-only">
          Your age
        </Label>
        <Input
          id="age"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="28"
          value={age}
          onChange={(event) =>
            setAge(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))
          }
          autoFocus
          className="h-16 max-w-32 text-center text-3xl font-semibold"
        />
        {age.trim() !== '' && !isValidAge(age) && (
          <p className="text-sm text-destructive">
            Enter an age between {MIN_AGE} and {MAX_AGE}.
          </p>
        )}
      </div>
    </div>,

    <div key="goal" className="space-y-8">
      <Question
        title="What do you want to change?"
        description="One thing to aim at. It becomes your first goal, and you can add more later."
      />

      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {GOAL_CATEGORY_ORDER.map((category) => {
            const chosen = goalCategory === category
            return (
              <button
                key={category}
                type="button"
                aria-pressed={chosen}
                onClick={() => setGoalCategory(category)}
                className={cn(
                  'cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors',
                  chosen
                    ? 'border-primary/35 bg-primary/10 text-primary'
                    : 'border-border/60 hover:border-primary/25'
                )}
              >
                {GOAL_CATEGORIES[category]}
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          <Label htmlFor="goal">Your goal</Label>
          <Input
            id="goal"
            placeholder="Run a half marathon"
            value={goalTitle}
            onChange={(event) => setGoalTitle(event.target.value)}
            maxLength={120}
            className="h-14 text-lg"
          />
        </div>
      </div>
    </div>,

    <div key="template" className="space-y-8">
      <Question
        title="Where do you want to start?"
        description="Pick a journal to begin with. You can change it or write your own later."
      />

      <div className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            aria-pressed={selectedTemplate === template.id}
            onClick={() => setSelectedTemplate(template.id)}
            className={cn(
              'flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors',
              selectedTemplate === template.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/40'
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PencilLineIcon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{template.name}</span>
              <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                {template.description}
              </span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <ZapIcon className="size-3" />+{template.xp_reward} XP
              </span>
            </span>
            <span
              className={cn(
                'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border text-transparent',
                selectedTemplate === template.id &&
                  'border-primary bg-primary text-primary-foreground'
              )}
            >
              <CheckIcon className="size-3.5" />
            </span>
          </button>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive">
          No starter templates are available yet. Add at least one active
          system template before completing onboarding.
        </div>
      )}
    </div>,
  ]

  const isLastStep = step === steps.length - 1
  const primaryDisabled =
    (step === 1 && !name.trim()) ||
    (step === 2 && !isValidAge(age)) ||
    (step === 3 && !goalTitle.trim()) ||
    (isLastStep && (!selectedTemplate || loading))

  async function handlePrimary() {
    if (isLastStep) {
      await handleComplete()
      return
    }
    setError(null)
    goToStep(step + 1)
  }

  async function handleComplete() {
    if (!selectedTemplate) return
    setLoading(true)
    setError(null)

    try {
      // Before the profile write, so a failure here can be retried without
      // having already marked onboarding complete -- which would drop the
      // goal on the floor and never ask again.
      await createGoal(supabase, userId, {
        title: goalTitle,
        category: goalCategory,
      })

      // Upsert rather than update: the profile row is created only by the auth
      // callback, so a sign-up that never passed through it (email confirmation
      // disabled) would update zero rows without erroring, leaving
      // onboarding_complete false and bouncing the user back here forever.
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
      if (!data || data.length === 0) {
        throw new Error('Profile was not written during onboarding')
      }

      // Seeding the city is a convenience; it is created lazily on /city too.
      // A failure here must not report an onboarding that already succeeded as
      // failed, or the retry would just repeat the same misleading error.
      try {
        await fetchCityState(supabase, userId)
      } catch (cityError) {
        console.error('City bootstrap failed after onboarding:', cityError)
      }

      router.push(`/journal/new/${selectedTemplate}?firstEntry=1`)
    } catch (err) {
      console.error('Onboarding error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full max-w-xl flex-col px-1 py-8">
      <div className="mb-10 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{stepLabels[step]}</span>
          <span className="tabular-nums">
            {step + 1} / {steps.length}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
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

          {error && (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {error}
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
          disabled={step === 0 || loading}
          className="h-12"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={handlePrimary}
          disabled={primaryDisabled}
          className="h-12 flex-1"
        >
          {loading ? (
            <>
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
              Setting up...
            </>
          ) : isLastStep ? (
            <>
              Start writing
              <PencilLineIcon data-icon="inline-end" />
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

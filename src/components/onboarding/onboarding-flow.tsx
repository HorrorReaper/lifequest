// src/components/onboarding/onboarding-flow.tsx

'use client'

import { type ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenCheckIcon,
  BrainIcon,
  Building2Icon,
  CalendarCheckIcon,
  CastleIcon,
  CheckIcon,
  ClipboardListIcon,
  CoinsIcon,
  CompassIcon,
  FlameIcon,
  GraduationCapIcon,
  Loader2Icon,
  MapIcon,
  MedalIcon,
  PencilLineIcon,
  RepeatIcon,
  RocketIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
  UserRoundIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { fetchCityState } from '@/lib/city/city'
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

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

const intentOptions = [
  {
    id: 'consistency',
    title: 'Build consistency',
    description: 'Turn journaling, habits, and tasks into a daily rhythm.',
    icon: FlameIcon,
  },
  {
    id: 'clarity',
    title: 'Understand myself better',
    description: 'Reflect on patterns, moods, decisions, and personal growth.',
    icon: BrainIcon,
  },
  {
    id: 'planning',
    title: 'Plan my days',
    description: 'Use your daily briefing to make today feel less scattered.',
    icon: CalendarCheckIcon,
  },
  {
    id: 'progress',
    title: 'Track visible progress',
    description: 'Earn XP, complete quests, and grow your city as proof.',
    icon: TrophyIcon,
  },
]

const rhythmOptions = [
  {
    id: 'new',
    title: 'New to this',
    description: 'I want a simple way to begin.',
    icon: SparklesIcon,
  },
  {
    id: 'waves',
    title: 'Hot and cold',
    description: 'I journal in waves and want more consistency.',
    icon: RepeatIcon,
  },
  {
    id: 'regular',
    title: 'Regular practice',
    description: 'I already reflect and want to go deeper.',
    icon: MedalIcon,
  },
]

const loopItems = [
  {
    title: 'Plan',
    description: "Check today's briefing: journal, habits, tasks, and daily plan.",
    icon: MapIcon,
  },
  {
    title: 'Act',
    description: 'Complete small actions and capture what happened.',
    icon: CheckIcon,
  },
  {
    title: 'Grow',
    description: 'Earn XP and coins, then build your city with the progress.',
    icon: Building2Icon,
  },
]

function TiltCard({ children }: { children: ReactNode }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rawRotateX = useTransform(y, [-0.5, 0.5], [8, -8])
  const rawRotateY = useTransform(x, [-0.5, 0.5], [-8, 8])
  const rotateX = useSpring(rawRotateX, { stiffness: 400, damping: 30 })
  const rotateY = useSpring(rawRotateY, { stiffness: 400, damping: 30 })
  const reduceMotion = useReducedMotion()

  if (reduceMotion) return <>{children}</>

  return (
    <div style={{ perspective: '700px' }}>
      <motion.div
        style={{ rotateX, rotateY }}
        whileHover={{ scale: 1.015 }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          x.set((e.clientX - rect.left) / rect.width - 0.5)
          y.set((e.clientY - rect.top) / rect.height - 0.5)
        }}
        onMouseLeave={() => {
          x.set(0)
          y.set(0)
        }}
      >
        {children}
      </motion.div>
    </div>
  )
}

function IconOrb({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex size-14 items-center justify-center rounded-2xl border border-white/60 bg-white/75 text-primary shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10',
        className
      )}
    >
      <Icon className="size-7" />
    </div>
  )
}

function ChoiceButton({
  title,
  description,
  icon: Icon,
  selected,
  onClick,
}: {
  title: string
  description: string
  icon: LucideIcon
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-4 rounded-2xl border border-white/60 bg-white/55 p-4 text-left shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15',
        selected && 'border-primary bg-primary/10 ring-2 ring-primary/20 dark:bg-primary/15'
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-muted-foreground shadow-sm transition-colors dark:bg-white/10',
          selected && 'bg-primary text-primary-foreground'
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground sm:text-base">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {description}
        </span>
      </span>
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 text-transparent transition-colors',
          selected && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        <CheckIcon className="size-3.5" />
      </span>
    </button>
  )
}

function StepHeader({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string
  title: string
  description?: string
  icon?: LucideIcon
}) {
  return (
    <div className="space-y-5">
      {icon && <IconOrb icon={icon} />}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        <h1 className="text-balance text-4xl font-bold leading-tight tracking-normal text-foreground sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
        )}
      </div>
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
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [intent, setIntent] = useState<string | null>(null)
  const [rhythm, setRhythm] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function goToStep(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const stepVariants = reduceMotion
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (dir: number) => ({
          opacity: 0,
          x: dir >= 0 ? 42 : -42,
          filter: 'blur(8px)',
        }),
        center: { opacity: 1, x: 0, filter: 'blur(0px)' },
        exit: (dir: number) => ({
          opacity: 0,
          x: dir >= 0 ? -42 : 42,
          filter: 'blur(8px)',
        }),
      }

  const stepLabels = ['Start', 'Name', 'Intent', 'Rhythm', 'Loop', 'First entry']

  const selectedIntent = intentOptions.find((option) => option.id === intent)
  const selectedRhythm = rhythmOptions.find((option) => option.id === rhythm)

  const steps = [
    <div key="welcome" className="space-y-9">
      <StepHeader
        eyebrow="Welcome to LifeQuest"
        title="Build your life like a city."
        description="Journal, plan, complete habits, and turn small daily actions into XP, coins, quests, lessons, and visible progress."
        icon={CastleIcon}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Reflect', icon: PencilLineIcon },
          { label: 'Progress', icon: ZapIcon },
          { label: 'Build', icon: Building2Icon },
        ].map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/55 p-3 text-sm font-medium shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>,

    <div key="profile" className="space-y-8">
      <StepHeader
        eyebrow="Hello, I am LifeQuest"
        title="What should I call you?"
        description="Your dashboard, briefing, and quests will feel more personal with a name."
        icon={UserRoundIcon}
      />

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            autoFocus
            className="h-14 rounded-2xl border-white/70 bg-white/70 px-4 text-lg shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex h-12 w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/10 dark:bg-white/10"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>,

    <div key="intent" className="space-y-7">
      <StepHeader
        eyebrow={name.trim() ? `Good to meet you, ${name.trim()}` : 'Good to meet you'}
        title="What brings you here?"
        description="Pick the reason that feels closest. LifeQuest will still give you the full toolkit."
        icon={CompassIcon}
      />

      <div className="grid gap-3">
        {intentOptions.map((option) => (
          <ChoiceButton
            key={option.id}
            {...option}
            selected={intent === option.id}
            onClick={() => setIntent(option.id)}
          />
        ))}
      </div>
    </div>,

    <div key="rhythm" className="space-y-7">
      <StepHeader
        eyebrow={selectedIntent ? 'That makes sense' : 'Your rhythm'}
        title="What is your current relationship with journaling?"
        description="This helps set the right tone: no guilt, no streak anxiety, just a useful daily practice."
        icon={BookOpenCheckIcon}
      />

      <div className="grid gap-3">
        {rhythmOptions.map((option) => (
          <ChoiceButton
            key={option.id}
            {...option}
            selected={rhythm === option.id}
            onClick={() => setRhythm(option.id)}
          />
        ))}
      </div>
    </div>,

    <div key="loop" className="space-y-8">
      <StepHeader
        eyebrow={
          selectedRhythm ? `For someone who is ${selectedRhythm.title.toLowerCase()}` : 'The loop'
        }
        title="Small actions become visible progress."
        description="LifeQuest is built around a simple loop that turns reflection and planning into momentum."
        icon={TargetIcon}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {loopItems.map((item, index) => (
          <div
            key={item.title}
            className="relative rounded-2xl border border-white/60 bg-white/55 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="size-5" />
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                0{index + 1}
              </span>
            </div>
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
        Your first mission is simple: choose a journal prompt and write the first entry.
      </div>
    </div>,

    <div key="template" className="space-y-7">
      <StepHeader
        eyebrow="First entry"
        title="Choose where to begin."
        description="Pick a starter journal. You can always change templates later or create your own."
        icon={PencilLineIcon}
      />

      <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {templates.map((template) => (
          <TiltCard key={template.id}>
            <button
              type="button"
              onClick={() => setSelectedTemplate(template.id)}
              className={cn(
                'flex h-full w-full items-start gap-4 rounded-2xl border border-white/60 bg-white/55 p-4 text-left shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15',
                selectedTemplate === template.id &&
                  'border-primary bg-primary/10 ring-2 ring-primary/20 dark:bg-primary/15'
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PencilLineIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{template.name}</span>
                <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted-foreground">
                  {template.description}
                </span>
                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 text-xs font-medium text-primary dark:bg-white/10">
                  <ZapIcon className="size-3" />
                  +{template.xp_reward} XP
                </span>
              </span>
              <span
                className={cn(
                  'mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 text-transparent',
                  selectedTemplate === template.id &&
                    'border-primary bg-primary text-primary-foreground'
                )}
              >
                <CheckIcon className="size-3.5" />
              </span>
            </button>
          </TiltCard>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          No starter templates are available yet. Add at least one active system template before completing onboarding.
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>,
  ]

  const isLastStep = step === steps.length - 1
  const primaryDisabled =
    (step === 1 && !name.trim()) ||
    (step === 2 && !intent) ||
    (step === 3 && !rhythm) ||
    (isLastStep && (!selectedTemplate || loading))

  async function handlePrimary() {
    if (isLastStep) {
      await handleComplete()
      return
    }

    goToStep(step + 1)
  }

  async function handleComplete() {
    if (!selectedTemplate) return
    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabaseUpdateWhere(
        supabase,
        'profiles',
        {
          username: name.trim(),
          timezone,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        },
        'id',
        userId
      )

      if (updateError) throw updateError

      await fetchCityState(supabase, userId)

      router.push(`/journal/new/${selectedTemplate}`)
    } catch (err) {
      console.error('Onboarding error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 shadow-2xl shadow-black/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/72">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-rose-300/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
      </div>

      <div className="relative grid min-h-[calc(100svh-4rem)] lg:min-h-[720px] lg:grid-cols-[0.78fr_1fr]">
        <aside className="hidden border-r border-white/50 bg-white/35 p-10 dark:border-white/10 dark:bg-white/5 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
              <CastleIcon className="size-4 text-primary" />
              LifeQuest setup
            </div>
            <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-normal">
              A calm operating system for your personal growth.
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Reflection, plans, habits, tasks, lessons, and quests connect into one visible progression loop.
            </p>
          </div>

          <div className="relative mx-auto flex h-80 w-80 items-center justify-center">
            <div className="absolute inset-8 rounded-full border border-dashed border-primary/25" />
            <div className="absolute left-8 top-12">
              <IconOrb icon={PencilLineIcon} />
            </div>
            <div className="absolute right-8 top-20">
              <IconOrb icon={ClipboardListIcon} />
            </div>
            <div className="absolute bottom-12 left-12">
              <IconOrb icon={GraduationCapIcon} />
            </div>
            <div className="absolute bottom-8 right-14">
              <IconOrb icon={CoinsIcon} />
            </div>
            <motion.div
              className="flex size-36 items-center justify-center rounded-[2rem] border border-white/70 bg-white/75 text-primary shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/10"
              animate={
                reduceMotion
                  ? undefined
                  : { y: [0, -8, 0], rotate: [0, 1.5, 0] }
              }
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Building2Icon className="size-16" />
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['XP', 'Levels'],
              ['Coins', 'City'],
              ['Quests', 'Growth'],
            ].map(([top, bottom]) => (
              <div
                key={top}
                className="rounded-2xl border border-white/60 bg-white/45 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <p className="text-sm font-semibold">{top}</p>
                <p className="text-xs text-muted-foreground">{bottom}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[calc(100svh-4rem)] flex-col p-5 sm:p-8 lg:min-h-[720px] lg:p-10">
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>{stepLabels[step]}</span>
              <span>
                {step + 1} / {steps.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
          </div>

          <div className="flex flex-1 items-center">
            <div className="w-full">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                >
                  {steps[step]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0 || loading}
              className="h-12 rounded-2xl border-white/70 bg-white/55 px-4 backdrop-blur dark:border-white/10 dark:bg-white/10"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={handlePrimary}
              disabled={primaryDisabled}
              className="h-12 flex-1 rounded-2xl"
            >
              {loading ? (
                <>
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  Setting up...
                </>
              ) : isLastStep ? (
                <>
                  Start writing
                  <RocketIcon data-icon="inline-end" />
                </>
              ) : (
                <>
                  Continue
                  <ArrowRightIcon data-icon="inline-end" />
                </>
              )}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpenText,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Coins,
  Flag,
  Flame,
  Focus,
  GraduationCap,
  Leaf,
  ListChecks,
  MoonStar,
  NotebookPen,
  Repeat2,
  Sparkles,
  Target,
} from 'lucide-react'
import { BuildingSprite } from '@/components/city/BuildingSprite'
import { BUILDING_CATALOG } from '@/lib/city/city'
import { cn } from '@/lib/utils'
import styles from './landing2.module.css'

export const metadata: Metadata = {
  title: 'LifeQuest | Turn daily progress into a city',
  description:
    'Plan your day, complete meaningful tasks and habits, reflect, and build a city that grows with your consistency.',
}

const dailyLoop = [
  {
    number: '01',
    label: 'Focus',
    title: 'Choose the next useful move',
    description: 'Today Focus brings your plan, tasks, habits, routines, and journal into one clear starting point.',
    icon: Focus,
  },
  {
    number: '02',
    label: 'Act',
    title: 'Follow through without switching tools',
    description: 'Check habits, finish tasks, run routines, and progress through focused quests from one daily system.',
    icon: CheckCircle2,
  },
  {
    number: '03',
    label: 'Reflect',
    title: 'Capture what the day taught you',
    description: 'Use calm journal rituals and save useful learnings instead of letting insights disappear overnight.',
    icon: NotebookPen,
  },
  {
    number: '04',
    label: 'Build',
    title: 'Make consistency visible',
    description: 'Turn progress into XP, coins, streaks, and buildings that make your effort tangible over time.',
    icon: Sparkles,
  },
]

const roadmap = [
  {
    phase: 'Now',
    status: 'Live beta',
    title: 'The complete daily loop',
    description:
      'Today Focus, tasks, habits, routines, planning, goals, quests, calm journaling, saved learnings, and the city builder work together in one mobile-optimized web app.',
  },
  {
    phase: 'Next',
    status: 'Hardening',
    title: 'Reliability before expansion',
    description:
      'Improve onboarding, account recovery, accessibility, performance, and the small daily interactions that determine whether LifeQuest becomes a lasting habit.',
  },
  {
    phase: 'After retention',
    status: 'Exploration',
    title: 'A stronger mobile foundation',
    description:
      'Explore a native, offline-friendly mobile experience with faster capture, thoughtful reminders, and the same account when the web MVP proves the core loop.',
  },
  {
    phase: 'Later',
    status: 'Direction',
    title: 'Deeper insight and connected growth',
    description:
      'Add useful weekly patterns, optional AI guidance, integrations, and social features only where they improve follow-through without adding noise.',
  },
]

const buildingById = new Map(BUILDING_CATALOG.map((building) => [building.id, building]))
const cityPlacements = [
  { id: 'tree', cell: 'col-start-1 row-start-1', animation: styles.cityFloatDelayed },
  { id: 'cafe', cell: 'col-start-3 row-start-1', animation: styles.cityFloat },
  { id: 'house', cell: 'col-start-5 row-start-1', animation: styles.cityFloatDelayed },
  { id: 'school', cell: 'col-start-2 row-start-3', animation: styles.cityFloat },
  { id: 'fountain', cell: 'col-start-4 row-start-3', animation: styles.cityFloatDelayed },
  { id: 'tree', cell: 'col-start-1 row-start-5', animation: styles.cityFloat },
  { id: 'library', cell: 'col-start-3 row-start-5', animation: styles.cityFloatDelayed },
  { id: 'house', cell: 'col-start-5 row-start-5', animation: styles.cityFloat },
]

function Brand() {
  return (
    <Link href="/landing2" className="group inline-flex items-center gap-2.5" aria-label="LifeQuest home">
      <span className="grid size-9 place-items-center rounded-[0.8rem] bg-[#315f50] text-[#f8f4e8] shadow-[0_7px_20px_rgb(49_95_80_/_0.2)] transition-transform group-hover:-rotate-3">
        <Leaf className="size-4.5" />
      </span>
      <span className="text-[1.05rem] font-bold tracking-[-0.03em]">LifeQuest</span>
    </Link>
  )
}

function CityMap({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        styles.mapGrid,
        'relative grid grid-cols-5 grid-rows-5 overflow-hidden border border-[#315f50]/20 shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.45),0_28px_80px_rgb(37_76_61_/_0.18)]',
        compact ? 'aspect-square rounded-[1.7rem] p-2' : 'aspect-square rounded-[2.3rem] p-3 sm:p-5'
      )}
    >
      <span className={cn(styles.mapRoadHorizontal, 'pointer-events-none absolute inset-x-0 top-[39%] h-[14%]')} />
      <span className={cn(styles.mapRoadVertical, 'pointer-events-none absolute bottom-0 left-[39%] top-0 w-[14%]')} />
      {cityPlacements.map((placement, index) => {
        const building = buildingById.get(placement.id)
        if (!building) return null

        return (
          <div
            key={`${placement.id}-${index}`}
            className={cn('relative z-10 grid place-items-center', placement.cell, placement.animation)}
          >
            <BuildingSprite building={building} className={compact ? 'size-14' : 'size-[4.5rem] sm:size-24'} />
          </div>
        )
      })}
    </div>
  )
}

function FocusPreview() {
  return (
    <div className="rounded-[1.6rem] border border-[#18332b]/12 bg-[#fffdf7]/96 p-4 text-[#18332b] shadow-[0_22px_70px_rgb(24_51_43_/_0.18)] backdrop-blur-xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#315f50] text-white">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-[-0.02em]">Today Focus</p>
          <p className="mt-0.5 text-xs text-[#5e7069]">Your next useful action</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-[#5e7069]">2 / 4</span>
      </div>
      <div className="mt-4 rounded-[1.1rem] bg-[#eef2e8] p-3.5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#68796d]">Next best move</p>
        <p className="mt-2 text-sm font-semibold">Write your 3-minute evening reflection.</p>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[#315f50] px-3 py-2.5 text-xs font-semibold text-white">
          <span className="inline-flex items-center gap-2"><BookOpenText className="size-3.5" /> Start reflection</span>
          <ArrowRight className="size-3.5" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-xl border border-[#18332b]/10 px-3 py-2.5"><Check className="mr-1.5 inline size-3.5 text-[#315f50]" />Task done</span>
        <span className="rounded-xl border border-[#18332b]/10 px-3 py-2.5"><Flame className="mr-1.5 inline size-3.5 text-[#b66a39]" />2 habits left</span>
      </div>
    </div>
  )
}

export default function LandingPageV2() {
  return (
    <div className={cn(styles.page, 'min-h-svh overflow-hidden selection:bg-[#e7b85c]/45')}>
      <header className="sticky top-0 z-50 border-b border-[#18332b]/10 bg-[#f4f1e7]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-6 text-sm font-medium text-[#526860] lg:flex" aria-label="Main navigation">
            <a href="#daily-loop" className="transition-colors hover:text-[#18332b]">The daily loop</a>
            <a href="#inside" className="transition-colors hover:text-[#18332b]">Inside LifeQuest</a>
            <a href="#mission" className="transition-colors hover:text-[#18332b]">Mission</a>
            <a href="#roadmap" className="transition-colors hover:text-[#18332b]">Roadmap</a>
            <a href="#faq" className="transition-colors hover:text-[#18332b]">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 py-2 text-sm font-semibold text-[#526860] transition-colors hover:text-[#18332b] sm:block">
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className="inline-flex min-h-10 items-center rounded-full bg-[#18332b] px-4 text-sm font-semibold text-[#fffdf7] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-24">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#315f50]/20 bg-[#e9eee3] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.13em] text-[#315f50]">
              <span className="size-1.5 rounded-full bg-[#d59a3b]" />
              Free during beta
            </div>
            <h1 className="max-w-[11ch] font-serif text-[clamp(3.35rem,8vw,6.9rem)] font-medium leading-[0.9] tracking-[-0.065em] text-[#18332b]">
              Turn daily progress into a city.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#526860] sm:text-xl">
              Plan what matters, complete your habits and tasks, reflect on the day, and build a city that grows with your consistency.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login?mode=signup"
                className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#315f50] px-6 text-sm font-bold text-white shadow-[0_14px_35px_rgb(49_95_80_/_0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#284f42] active:translate-y-0"
              >
                Start building for free <ArrowRight className="ml-2 size-4" />
              </Link>
              <a
                href="#daily-loop"
                className="inline-flex min-h-13 items-center justify-center rounded-full border border-[#18332b]/18 bg-[#fffdf7]/60 px-6 text-sm font-bold transition-colors hover:bg-[#fffdf7]"
              >
                See the daily loop
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#687970]">
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Mobile-optimized web app</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Google or email signup</span>
              <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Syncs across devices</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[42rem] pb-10 lg:pb-0">
            <div className="absolute -inset-8 rounded-full bg-[#9fbb82]/22 blur-3xl" />
            <div className="relative ml-auto w-[88%] rotate-[1.5deg] sm:w-[82%]">
              <CityMap />
            </div>
            <div className={cn(styles.focusFloat, 'absolute -bottom-2 left-0 z-20 w-[72%] min-w-[17.5rem] max-w-[22rem] sm:bottom-5')}>
              <FocusPreview />
            </div>
            <div className="absolute -right-1 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-[#18332b]/12 bg-[#fffdf7]/95 px-3.5 py-2 text-xs font-bold shadow-lg backdrop-blur sm:right-2">
              <Coins className="size-3.5 text-[#b27c22]" /> Progress becomes a place
            </div>
          </div>
        </section>

        <div className="overflow-hidden border-y border-[#18332b]/12 bg-[#18332b] py-3 text-[#f4f1e7]" aria-hidden="true">
          <div className={cn(styles.ticker, 'flex w-max whitespace-nowrap text-xs font-bold uppercase tracking-[0.19em]')}>
            {Array.from({ length: 2 }).map((_, group) => (
              <div key={group} className="flex items-center gap-8 pr-8">
                {['Focus the day', 'Complete the work', 'Reflect with intention', 'Build what you earned'].map((item) => (
                  <span key={`${group}-${item}`} className="inline-flex items-center gap-8">
                    {item}<span className="text-[#e7b85c]">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section id="daily-loop" className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f806d]">One loop, every day</p>
              <h2 className="mt-4 max-w-[10ch] font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-6xl">
                Less switching. More follow-through.
              </h2>
              <p className="mt-6 max-w-md leading-7 text-[#5a6f66]">
                LifeQuest does not ask you to manage another complicated system. It keeps the next useful action visible and closes the day with reflection.
              </p>
            </div>

            <ol className="border-t border-[#18332b]/15">
              {dailyLoop.map((step) => {
                const Icon = step.icon
                return (
                  <li key={step.number} className="grid gap-5 border-b border-[#18332b]/15 py-8 sm:grid-cols-[4rem_1fr_auto] sm:items-start sm:py-10">
                    <span className="font-mono text-xs font-bold text-[#829187]">{step.number}</span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6d806e]">{step.label}</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">{step.title}</h3>
                      <p className="mt-3 max-w-xl leading-7 text-[#5a6f66]">{step.description}</p>
                    </div>
                    <span className="grid size-12 place-items-center rounded-2xl bg-[#e2e8d8] text-[#315f50]">
                      <Icon className="size-5" />
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        <section id="inside" className="bg-[#e6e9dd] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#68796d]">Inside LifeQuest</p>
              <h2 className="mt-4 font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">A calm system with a playful reward.</h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5a6f66]">
                The interface helps you focus. The game gives you a reason to return. Neither gets in the way of the work itself.
              </p>
            </div>

            <div className="mt-14 grid auto-rows-[minmax(17rem,auto)] gap-4 lg:grid-cols-12">
              <article className="relative overflow-hidden rounded-[2rem] bg-[#fffdf7] p-6 shadow-[0_18px_55px_rgb(34_66_54_/_0.08)] sm:p-8 lg:col-span-7">
                <div className="max-w-sm">
                  <span className="grid size-11 place-items-center rounded-2xl bg-[#dfe9dd] text-[#315f50]"><Focus className="size-5" /></span>
                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Run the day from Today Focus</h3>
                  <p className="mt-3 leading-7 text-[#5a6f66]">See the next plan block, top task, habit chain, journal, and routines without turning your dashboard into noise.</p>
                </div>
                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  {[
                    { icon: CalendarCheck2, label: 'Plan', value: '09:30 Deep work' },
                    { icon: ListChecks, label: 'Task', value: 'Ship the draft' },
                    { icon: Flame, label: 'Habit', value: '2 of 3 checked' },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label} className="rounded-2xl border border-[#18332b]/10 bg-[#f5f5ec] p-4">
                        <Icon className="size-4 text-[#527565]" />
                        <p className="mt-4 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[#829187]">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold">{item.value}</p>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-[2rem] bg-[#315f50] p-6 text-[#f7f4e9] shadow-[0_18px_55px_rgb(34_66_54_/_0.15)] sm:p-8 lg:col-span-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-white/12 text-[#f0cf83]"><NotebookPen className="size-5" /></span>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Reflect without filling out a survey</h3>
                <p className="mt-3 leading-7 text-white/70">Choose a calm ritual, write in spacious fields, and save the learning that should shape tomorrow.</p>
                <div className="mt-8 rounded-[1.4rem] bg-[#f8f5eb] p-5 text-[#18332b]">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#718178]"><span>Evening reflection</span><span>2 / 3</span></div>
                  <p className="mt-5 text-sm font-semibold">What is worth remembering from today?</p>
                  <div className="mt-3 h-20 rounded-xl border border-[#18332b]/10 bg-white p-3 text-xs leading-5 text-[#829187]">Capture the decision, pattern, or lesson...</div>
                </div>
              </article>

              <article className="rounded-[2rem] border border-[#18332b]/10 bg-[#f2eddc] p-6 sm:p-8 lg:col-span-5">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#ead8a9] text-[#76581f]"><Repeat2 className="size-5" /></span>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">Build systems, not isolated checkmarks</h3>
                <p className="mt-3 leading-7 text-[#5a6f66]">Chain habits into routines, pursue goals through quests, and use focused challenges when you need a stronger commitment.</p>
                <div className="mt-8 space-y-2.5">
                  {[
                    { icon: Repeat2, title: 'Morning routine', meta: '3 habits · 12 min' },
                    { icon: Flag, title: '30-day challenge', meta: 'Day 8 · Social confidence' },
                    { icon: Target, title: 'Active goal', meta: 'Launch the first beta' },
                  ].map((item) => {
                    const Icon = item.icon
                    return (
                      <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-[#fffdf7]/75 px-4 py-3">
                        <Icon className="size-4 text-[#527565]" />
                        <span className="min-w-0 flex-1 text-sm font-semibold">{item.title}</span>
                        <span className="hidden text-xs text-[#829187] sm:block">{item.meta}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="relative overflow-hidden rounded-[2rem] bg-[#19382e] p-6 text-white sm:p-8 lg:col-span-7">
                <div className="relative z-10 max-w-sm">
                  <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-[#c8df9f]"><Sparkles className="size-5" /></span>
                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.04em]">See discipline become a skyline</h3>
                  <p className="mt-3 leading-7 text-white/65">Unlock a growing catalog of homes, nature, shops, civic buildings, and landmarks. Place each reward where you want it.</p>
                </div>
                <div className="mt-8 ml-auto w-full max-w-sm sm:absolute sm:-bottom-16 sm:-right-10 sm:mt-0 sm:w-[48%] lg:w-[52%]">
                  <CityMap compact />
                </div>
              </article>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-[1.4rem] border border-[#18332b]/10 bg-[#fffdf7]/55 px-5 py-5 text-sm font-semibold text-[#526860]">
              <span className="inline-flex items-center gap-2"><BookOpenText className="size-4" /> Custom journal templates</span>
              <span className="inline-flex items-center gap-2"><GraduationCap className="size-4" /> Learning articles</span>
              <span className="inline-flex items-center gap-2"><MoonStar className="size-4" /> Calm White Mode</span>
              <span className="inline-flex items-center gap-2"><Flag className="size-4" /> Quests and challenges</span>
            </div>
          </div>
        </section>

        <section id="mission" className="relative overflow-hidden border-y border-[#18332b]/10 bg-[#f2eddc] px-5 py-24 sm:px-8 sm:py-32">
          <div className={cn(styles.paperGrid, 'pointer-events-none absolute inset-0 opacity-55')} />
          <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#68796d]">Our mission</p>
              <h2 className="mt-4 max-w-[9ch] font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-6xl">
                Make progress feel alive.
              </h2>
              <p className="mt-6 max-w-sm text-sm font-semibold text-[#526860]">
                Patrick Eger · Founder of LifeQuest
              </p>
            </div>

            <div>
              <p className="max-w-3xl font-serif text-[clamp(1.9rem,4vw,3.5rem)] leading-[1.12] tracking-[-0.045em]">
                “Self-development only changes your life when reflection becomes action, and action becomes something you can sustain.”
              </p>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-[#5a6f66]">
                LifeQuest exists to connect those pieces. It gives you one place to decide what matters, follow through, understand what you learned, and see the result of returning day after day.
              </p>

              <div className="mt-12 grid border-y border-[#18332b]/15 sm:grid-cols-3">
                {[
                  {
                    icon: Focus,
                    title: 'Clarity over clutter',
                    description: 'The next useful action should be easier to see than the entire backlog.',
                  },
                  {
                    icon: BookOpenText,
                    title: 'Reflection with a purpose',
                    description: 'A journal should improve tomorrow, not become another archive you never revisit.',
                  },
                  {
                    icon: Sparkles,
                    title: 'Rewards with meaning',
                    description: 'Game mechanics should reinforce real progress rather than distract from it.',
                  },
                ].map((value) => {
                  const Icon = value.icon
                  return (
                    <div key={value.title} className="py-6 sm:px-5 sm:first:pl-0 sm:last:pr-0">
                      <Icon className="size-5 text-[#315f50]" />
                      <h3 className="mt-4 text-sm font-bold">{value.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#687970]">{value.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="roadmap" className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#68796d]">Product roadmap</p>
                <h2 className="mt-4 font-serif text-5xl leading-none tracking-[-0.05em] sm:text-6xl">
                  Build the foundation. Earn the right to expand.
                </h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-[#5a6f66] lg:justify-self-end">
                The roadmap follows evidence, not feature volume. LifeQuest will improve the daily loop first, validate retention second, and only then add new surfaces.
              </p>
            </div>

            <ol className="mt-16 border-t border-[#18332b]/15">
              {roadmap.map((item, index) => (
                <li
                  key={item.phase}
                  className="grid gap-5 border-b border-[#18332b]/15 py-8 sm:grid-cols-[5rem_8rem_1fr] sm:items-start sm:gap-8 sm:py-10"
                >
                  <span className="font-mono text-xs font-bold text-[#829187]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-sm font-bold">{item.phase}</p>
                    <span className="mt-2 inline-flex rounded-full border border-[#315f50]/18 bg-[#e4eadc] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[#315f50]">
                      {item.status}
                    </span>
                  </div>
                  <div className="max-w-2xl">
                    <h3 className="text-2xl font-semibold tracking-[-0.035em]">{item.title}</h3>
                    <p className="mt-3 leading-7 text-[#5a6f66]">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.4rem] bg-[#18332b] text-[#f8f4e8] lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-8 sm:p-12 lg:p-16">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d9bc78]">The beta is open</p>
              <h2 className="mt-5 max-w-[11ch] font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-6xl">Build the system you will actually return to.</h2>
              <p className="mt-6 max-w-xl leading-7 text-white/65">LifeQuest is currently a mobile-optimized web MVP. Join during the beta, use the full daily loop, and help shape what becomes essential.</p>
              <Link href="/login?mode=signup" className="mt-9 inline-flex min-h-13 items-center rounded-full bg-[#e7b85c] px-6 text-sm font-bold text-[#18332b] transition-transform hover:-translate-y-0.5 active:translate-y-0">
                Create your free account <ArrowRight className="ml-2 size-4" />
              </Link>
            </div>
            <div className={cn(styles.paperGrid, 'flex min-h-80 items-end justify-center bg-[#25493e] px-8 pt-12')}>
              <div className="w-full max-w-sm translate-y-10 rounded-t-[2rem] border border-white/15 bg-[#f7f3e8] p-6 text-[#18332b] shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#718178]">Beta access includes</p>
                <ul className="mt-5 space-y-3 text-sm font-semibold">
                  {[
                    'The complete daily LifeQuest loop',
                    'Mobile and desktop web access',
                    'Account sync across supported devices',
                    'New improvements as the MVP evolves',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-[#315f50]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="mx-auto grid max-w-6xl gap-12 px-5 pb-28 sm:px-8 lg:grid-cols-[0.65fr_1.35fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#68796d]">Questions</p>
            <h2 className="mt-4 font-serif text-5xl tracking-[-0.05em]">Before you begin.</h2>
          </div>
          <div className="divide-y divide-[#18332b]/15 border-y border-[#18332b]/15">
            {[
              ['Is LifeQuest free?', 'LifeQuest is free during the MVP beta. The page does not promise permanent pricing before the product and business model are validated.'],
              ['Is there a native mobile app?', 'Not yet. The current MVP is a responsive web application designed to work well on mobile devices and desktop browsers.'],
              ['What can I manage inside LifeQuest?', 'Your daily plan, tasks, habits, routines, goals, quests, journal entries, saved learnings, and personal city all live in the same account.'],
              ['Does my progress sync?', 'Yes. Your account data is saved securely and is available when you sign in on another supported device.'],
            ].map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold tracking-[-0.025em] marker:content-none">
                  {question}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[#18332b]/15 text-lg font-normal transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pt-4 leading-7 text-[#5a6f66]">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#18332b]/12 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <p className="text-xs text-[#718178]">A daily system for visible progress. © 2026 LifeQuest.</p>
          <div className="flex gap-5 text-xs font-semibold text-[#526860]">
            <Link href="/privacy" className="hover:text-[#18332b]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#18332b]">Terms</Link>
            <Link href="/login" className="hover:text-[#18332b]">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

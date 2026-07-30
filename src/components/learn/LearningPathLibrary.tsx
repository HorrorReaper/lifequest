'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  LockKeyhole,
  Play,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getPathCompletion,
  getPathLessons,
  getTotalMasteryPoints,
  isLessonUnlocked,
  type LearningCatalog,
  type LearningPath,
  type LearningProgress,
} from '@/lib/learning-paths'
import {
  LEARNING_CATALOG_EVENT,
  readLocalLearningCatalog,
  readLocalLearningProgress,
} from '@/lib/learning-local'
import type { LessonWithStatus } from '@/lib/lessons'
import { LessonCard } from './LessonCard'

const ACCENTS = {
  violet: {
    panel: 'from-violet-500/18 via-violet-500/8 to-transparent',
    active: 'border-violet-500/50 bg-violet-500/10',
    icon: 'bg-violet-500 text-white',
    soft: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    line: 'bg-violet-500/25',
  },
  amber: {
    panel: 'from-amber-500/18 via-amber-500/8 to-transparent',
    active: 'border-amber-500/50 bg-amber-500/10',
    icon: 'bg-amber-500 text-white',
    soft: 'bg-amber-500/10 text-amber-800 dark:text-amber-300',
    line: 'bg-amber-500/25',
  },
  emerald: {
    panel: 'from-emerald-500/18 via-emerald-500/8 to-transparent',
    active: 'border-emerald-500/50 bg-emerald-500/10',
    icon: 'bg-emerald-500 text-white',
    soft: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    line: 'bg-emerald-500/25',
  },
} as const

function calculateLearningStreak(progress: LearningProgress) {
  const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const days = new Set(
    Object.values(progress.completions).map((completion) => dateKey(new Date(completion.completedAt)))
  )
  if (days.size === 0) return 0
  const cursor = new Date()
  const today = dateKey(cursor)
  if (!days.has(today)) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(dateKey(cursor))) return 0
  }
  let streak = 0
  while (days.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function findContinueLesson(path: LearningPath, progress: LearningProgress) {
  return getPathLessons(path).find(
    (lesson) =>
      !progress.completions[lesson.id] && isLessonUnlocked(path, lesson.id, progress)
  )
}

interface LearningPathLibraryProps {
  catalog: LearningCatalog
  progress: LearningProgress
  backendEnabled: boolean
  legacyLessons: LessonWithStatus[]
}

export function LearningPathLibrary({
  catalog: initialCatalog,
  progress: initialProgress,
  backendEnabled,
  legacyLessons,
}: LearningPathLibraryProps) {
  const [catalog, setCatalog] = useState<LearningCatalog>(initialCatalog)
  const [progress, setProgress] = useState<LearningProgress>(initialProgress)
  const [selectedPathId, setSelectedPathId] = useState(initialCatalog.paths[0].id)
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    if (backendEnabled) return
    const load = () => {
      const nextCatalog = readLocalLearningCatalog()
      setCatalog(nextCatalog)
      setProgress(readLocalLearningProgress())
      setSelectedPathId((current) =>
        nextCatalog.paths.some((path) => path.id === current)
          ? current
          : nextCatalog.paths[0]?.id ?? current
      )
    }
    load()
    window.addEventListener('focus', load)
    window.addEventListener(LEARNING_CATALOG_EVENT, load)
    return () => {
      window.removeEventListener('focus', load)
      window.removeEventListener(LEARNING_CATALOG_EVENT, load)
    }
  }, [backendEnabled, initialCatalog, initialProgress])

  const selectedPath =
    catalog.paths.find((path) => path.id === selectedPathId) ?? catalog.paths[0]
  const pathCompletion = selectedPath
    ? getPathCompletion(selectedPath, progress)
    : { completed: 0, total: 0, percent: 0 }
  const continueLesson = selectedPath
    ? findContinueLesson(selectedPath, progress)
    : undefined
  const masteryPoints = useMemo(
    () => getTotalMasteryPoints(catalog, progress),
    [catalog, progress]
  )
  const streak = useMemo(() => calculateLearningStreak(progress), [progress])

  if (!selectedPath) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No learning paths are published.</p>
  }

  const accent = ACCENTS[selectedPath.accent]

  return (
    <div className="space-y-7">
      <section
        className={cn(
          'overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-5 sm:p-7',
          accent.panel
        )}
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', accent.soft)}>
                Your active path
              </span>
              <span className="rounded-full bg-background/75 px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                {backendEnabled ? 'Synced learning progress' : 'Offline preview'}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              {selectedPath.icon} {selectedPath.title}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
              {selectedPath.description}
            </p>
            {continueLesson ? (
              <Button className="mt-5" size="lg" asChild>
                <Link href={`/learn/${continueLesson.id}`}>
                  <Play className="fill-current" />
                  Continue: {continueLesson.title}
                </Link>
              </Button>
            ) : (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Trophy className="size-4" />
                Path mastered
              </div>
            )}
          </div>

          <div className="grid min-w-[15rem] grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background/75 p-4 ring-1 ring-border backdrop-blur">
              <Sparkles className="size-4 text-amber-500" />
              <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{masteryPoints}</p>
              <p className="text-xs text-muted-foreground">Mastery points</p>
            </div>
            <div className="rounded-2xl bg-background/75 p-4 ring-1 ring-border backdrop-blur">
              <Flame className="size-4 text-orange-500" />
              <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{streak}</p>
              <p className="text-xs text-muted-foreground">Learning streak</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-background/75 p-4 ring-1 ring-border backdrop-blur">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-mono text-2xl font-semibold tabular-nums">
                    {pathCompletion.percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pathCompletion.completed} of {pathCompletion.total} lessons
                  </p>
                </div>
                <p className="text-xs font-medium text-muted-foreground">Path progress</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-[width]', accent.icon)}
                  style={{ width: `${pathCompletion.percent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Choose your path
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Three skills, one stronger life</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {catalog.paths.map((path) => {
            const completion = getPathCompletion(path, progress)
            const pathAccent = ACCENTS[path.accent]
            const active = path.id === selectedPath.id
            return (
              <button
                key={path.id}
                type="button"
                onClick={() => setSelectedPathId(path.id)}
                className={cn(
                  'rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
                  active ? pathAccent.active : 'border-border hover:border-foreground/20'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('grid size-11 place-items-center rounded-2xl text-xl', pathAccent.soft)}>
                    {path.icon}
                  </span>
                  {active && <Check className="size-4" />}
                </div>
                <h3 className="mt-4 font-semibold">{path.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{path.outcome}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', pathAccent.icon)} style={{ width: `${completion.percent}%` }} />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{completion.percent}%</span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-8">
        <div className="text-center">
          <p className={cn('mx-auto inline-flex rounded-full px-3 py-1 text-xs font-semibold', accent.soft)}>
            {selectedPath.outcome}
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Your learning journey</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete lessons in order. Every lesson mixes concepts, decisions, scenarios, and reflection.
          </p>
        </div>

        {selectedPath.units.map((unit, unitIndex) => (
          <div key={unit.id} className="relative">
            <div className="mb-5 flex items-start gap-3">
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl font-mono text-sm font-bold', accent.soft)}>
                {unitIndex + 1}
              </span>
              <div>
                <h3 className="font-semibold">{unit.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{unit.description}</p>
              </div>
            </div>

            <div className="relative space-y-3 pl-4 sm:pl-10">
              <div className={cn('absolute bottom-7 left-[2.15rem] top-7 hidden w-0.5 sm:block', accent.line)} />
              {unit.lessons.map((lesson) => {
                const complete = Boolean(progress.completions[lesson.id])
                const unlocked = isLessonUnlocked(selectedPath, lesson.id, progress)
                const content = (
                  <div
                    className={cn(
                      'relative flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all sm:p-5',
                      unlocked && !complete && 'hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md',
                      complete && 'border-emerald-500/30 bg-emerald-500/5',
                      !unlocked && 'bg-muted/30 opacity-65'
                    )}
                  >
                    <div
                      className={cn(
                        'z-10 grid size-12 shrink-0 place-items-center rounded-2xl text-xl ring-4 ring-background',
                        complete
                          ? 'bg-emerald-500 text-white'
                          : unlocked
                            ? accent.icon
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {complete ? <Check className="size-5" /> : unlocked ? lesson.icon : <LockKeyhole className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{lesson.title}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                          {lesson.difficulty}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{lesson.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock3 className="size-3" />{lesson.estimatedMinutes} min</span>
                        <span className="flex items-center gap-1"><Sparkles className="size-3" />{lesson.masteryPoints} mastery</span>
                      </div>
                    </div>
                    {unlocked && <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
                  </div>
                )

                return unlocked ? (
                  <Link key={lesson.id} href={`/learn/${lesson.id}`} aria-label={`${complete ? 'Review' : 'Start'} ${lesson.title}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={lesson.id} aria-label={`${lesson.title} is locked`}>
                    {content}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-muted/25 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setShowArchive((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={showArchive}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-background ring-1 ring-border">
              <BookOpenCheck className="size-4" />
            </span>
            <div>
              <p className="font-semibold">Foundation lesson archive</p>
              <p className="text-xs text-muted-foreground">
                {legacyLessons.length} original LifeQuest article quizzes
              </p>
            </div>
          </div>
          <ArrowRight className={cn('size-4 transition-transform', showArchive && 'rotate-90')} />
        </button>
        {showArchive && (
          <div className="mt-5 space-y-3">
            {legacyLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} />)}
          </div>
        )}
      </section>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  GripVertical,
  Heart,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  getNextLessonId,
  type LearningCatalog,
  type LearningExercise,
  type LearningPath,
  type LearningProgress,
  type PathLesson,
} from '@/lib/learning-paths'
import { completeLocalPathLesson } from '@/lib/learning-local'
import {
  submitLearningExercise,
  type ExerciseSubmissionResult,
} from '@/lib/learning-api'
import { createClient } from '@/lib/supabase/client'

const ACCENTS = {
  violet: {
    fill: 'bg-violet-500',
    soft: 'bg-violet-500/10 text-violet-800 dark:text-violet-300',
    border: 'border-violet-500/40',
    button: 'bg-violet-600 text-white hover:bg-violet-700',
  },
  amber: {
    fill: 'bg-amber-500',
    soft: 'bg-amber-500/10 text-amber-900 dark:text-amber-300',
    border: 'border-amber-500/40',
    button: 'bg-amber-500 text-black hover:bg-amber-400',
  },
  emerald: {
    fill: 'bg-emerald-500',
    soft: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-300',
    border: 'border-emerald-500/40',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
} as const

function rotatedItems(items: string[]) {
  if (items.length < 2) return items
  return [...items.slice(1), items[0]]
}

function exerciseLabel(exercise: LearningExercise) {
  switch (exercise.type) {
    case 'concept': return 'Learn'
    case 'choice': return 'Quick check'
    case 'scenario': return 'Apply it'
    case 'order': return 'Build the sequence'
    case 'reflection': return 'Make it yours'
  }
}

interface InteractiveLessonPlayerProps {
  catalog: LearningCatalog
  path: LearningPath
  lesson: PathLesson
  progress: LearningProgress
  backendEnabled: boolean
}

export function InteractiveLessonPlayer({
  catalog,
  path,
  lesson,
  progress,
  backendEnabled,
}: InteractiveLessonPlayerProps) {
  const reduceMotion = useReducedMotion()
  const accent = ACCENTS[path.accent]
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null)
  const [ordered, setOrdered] = useState<string[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [reflections, setReflections] = useState<Record<string, string>>(progress.reflections)
  const [complete, setComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [completionResult, setCompletionResult] = useState<ExerciseSubmissionResult | null>(null)

  const exercise = lesson.exercises[stepIndex]
  const nextLessonId = getNextLessonId(catalog, lesson.id)
  const score = Math.max(60, 100 - mistakes * 10)
  const hearts = Math.max(0, 3 - mistakes)
  const progressPercent = Math.round(((stepIndex + (complete ? 1 : 0)) / lesson.exercises.length) * 100)
  const availableOrderItems = useMemo(() => {
    if (exercise?.type !== 'order') return []
    const availableItems = backendEnabled ? exercise.items : rotatedItems(exercise.items)
    return availableItems.filter((item) => !ordered.includes(item))
  }, [backendEnabled, exercise, ordered])

  function resetInteraction() {
    setSelectedOption(null)
    setAnswerCorrect(null)
    setOrdered([])
    setOrderChecked(false)
  }

  function goBack() {
    if (stepIndex === 0) return
    setDirection(-1)
    setStepIndex((current) => current - 1)
    resetInteraction()
  }

  async function selectAnswer(index: number) {
    if (exercise.type !== 'choice' && exercise.type !== 'scenario') return
    if (answerCorrect || submitting) return
    setSelectedOption(index)
    setSubmissionError(null)
    if (!backendEnabled) {
      const correct = index === exercise.correctIndex
      setAnswerCorrect(correct)
      if (!correct) setMistakes((current) => current + 1)
      return
    }

    setSubmitting(true)
    try {
      const result = await submitLearningExercise(
        createClient(),
        lesson.id,
        exercise.id,
        { selectedIndex: index }
      )
      setAnswerCorrect(result.correct)
      setMistakes(result.mistakes)
    } catch (error) {
      setSelectedOption(null)
      setSubmissionError(error instanceof Error ? error.message : 'Could not check the answer.')
    } finally {
      setSubmitting(false)
    }
  }

  async function checkOrder() {
    if (exercise.type !== 'order') return
    if (!backendEnabled) {
      const correct = exercise.items.every((item, index) => ordered[index] === item)
      setOrderChecked(true)
      setAnswerCorrect(correct)
      if (!correct) setMistakes((current) => current + 1)
      return
    }

    setSubmitting(true)
    setSubmissionError(null)
    try {
      const result = await submitLearningExercise(
        createClient(),
        lesson.id,
        exercise.id,
        { items: ordered }
      )
      setOrderChecked(true)
      setAnswerCorrect(result.correct)
      setMistakes(result.mistakes)
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Could not check the sequence.')
    } finally {
      setSubmitting(false)
    }
  }

  function retryOrder() {
    setOrdered([])
    setOrderChecked(false)
    setAnswerCorrect(null)
  }

  function canContinue() {
    switch (exercise.type) {
      case 'concept': return true
      case 'choice':
      case 'scenario': return answerCorrect === true
      case 'order': return answerCorrect === true
      case 'reflection': return (reflections[exercise.id] ?? '').trim().length >= 3
    }
  }

  async function continueLesson() {
    if (!canContinue()) return
    setSubmissionError(null)

    let serverResult: ExerciseSubmissionResult | null = null
    if (backendEnabled && exercise.type === 'reflection') {
      setSubmitting(true)
      try {
        serverResult = await submitLearningExercise(
          createClient(),
          lesson.id,
          exercise.id,
          { text: reflections[exercise.id] ?? '' }
        )
        setMistakes(serverResult.mistakes)
        if (!serverResult.correct) {
          setSubmissionError('Add a more specific reflection before continuing.')
          return
        }
      } catch (error) {
        setSubmissionError(error instanceof Error ? error.message : 'Could not save your reflection.')
        return
      } finally {
        setSubmitting(false)
      }
    }

    if (stepIndex === lesson.exercises.length - 1) {
      const lessonReflections = Object.fromEntries(
        lesson.exercises
          .filter((item) => item.type === 'reflection')
          .map((item) => [item.id, reflections[item.id] ?? ''])
      )
      if (backendEnabled) {
        if (!serverResult?.completed) {
          setSubmissionError('Finish every interactive check before completing this lesson.')
          return
        }
        setCompletionResult(serverResult)
      } else {
        completeLocalPathLesson(lesson.id, score, mistakes, lessonReflections)
      }
      setComplete(true)
      return
    }
    setDirection(1)
    setStepIndex((current) => current + 1)
    resetInteraction()
  }

  if (complete) {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-4">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md overflow-hidden rounded-[2rem] border bg-card shadow-xl"
        >
          <div className={cn('grid min-h-48 place-items-center bg-gradient-to-br p-8', accent.soft)}>
            <motion.div
              initial={reduceMotion ? false : { rotate: -12, scale: 0.7 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className={cn('grid size-24 place-items-center rounded-[2rem] text-white shadow-lg', accent.fill)}
            >
              <Trophy className="size-11" />
            </motion.div>
          </div>
          <div className="p-6 text-center sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Lesson mastered</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{lesson.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">You applied the idea, corrected mistakes, and made it personal.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="font-mono text-2xl font-semibold">{completionResult?.score ?? score}%</p>
                <p className="text-xs text-muted-foreground">Best score</p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="font-mono text-2xl font-semibold">+{completionResult?.xpAwarded ?? lesson.masteryPoints}</p>
                <p className="text-xs text-muted-foreground">{backendEnabled ? 'XP awarded' : 'Local mastery'}</p>
              </div>
            </div>
            <div className="mt-6 space-y-2">
              {nextLessonId ? (
                <Button className={cn('w-full', accent.button)} size="lg" asChild>
                  <Link href={`/learn/${nextLessonId}`}>Continue path <ArrowRight /></Link>
                </Button>
              ) : (
                <Button className={cn('w-full', accent.button)} size="lg" asChild>
                  <Link href="/learn">View completed path <Sparkles /></Link>
                </Button>
              )}
              <Button className="w-full" variant="ghost" asChild>
                <Link href="/learn">Back to learning paths</Link>
              </Button>
            </div>
            {backendEnabled && completionResult && (
              <p className="mt-4 text-xs text-muted-foreground">
                {completionResult.rewarded
                  ? `${completionResult.coinsAwarded} coins were added to your city.`
                  : 'Lesson progress was already rewarded on an earlier completion.'}
              </p>
            )}
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/learn" aria-label="Leave lesson"><X /></Link>
          </Button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', accent.fill)}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: reduceMotion ? 0 : 0.25 }}
            />
          </div>
          <div className="flex items-center gap-1 text-rose-500" aria-label={`${hearts} focus hearts remaining`}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Heart key={index} className={cn('size-4', index < hearts && 'fill-current')} />
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-3xl flex-col px-4 pb-6 pt-6 sm:px-8 sm:pt-10">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', accent.soft)}>
              {exerciseLabel(exercise)}
            </p>
            <p className="text-xs text-muted-foreground">{stepIndex + 1} of {lesson.exercises.length}</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{path.icon} {path.title} · {lesson.title}</p>
        </div>

        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.section
              key={exercise.id}
              custom={direction}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? 28 : -28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -28 : 28 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
              className="flex flex-1 flex-col"
            >
              {exercise.type === 'concept' && (
                <div className="my-auto">
                  <div className={cn('mb-6 grid size-16 place-items-center rounded-2xl', accent.soft)}>
                    <Lightbulb className="size-7" />
                  </div>
                  <h1 className="max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{exercise.title}</h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/85 sm:text-lg sm:leading-8">{exercise.body}</p>
                  <div className={cn('mt-7 rounded-2xl border p-4 text-sm leading-6', accent.soft, accent.border)}>
                    <span className="font-semibold">Key idea: </span>{exercise.takeaway}
                  </div>
                </div>
              )}

              {(exercise.type === 'choice' || exercise.type === 'scenario') && (
                <div className="my-auto">
                  {exercise.type === 'scenario' && (
                    <div className={cn('mb-5 rounded-2xl p-4 text-sm leading-6', accent.soft)}>
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">Scenario</p>
                      <p className="mt-2">{exercise.context}</p>
                    </div>
                  )}
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{exercise.prompt}</h1>
                  <div className="mt-6 space-y-3">
                    {exercise.options.map((option, index) => {
                      const selected = selectedOption === index
                      const correct = selected && answerCorrect === true
                      const wrong = selected && answerCorrect === false
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => selectAnswer(index)}
                          disabled={submitting}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-foreground/25 sm:p-5',
                            correct && 'border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
                            wrong && 'border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200'
                          )}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted font-mono text-xs">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {correct && <CircleCheck className="size-5 text-emerald-600" />}
                          {wrong && <X className="size-5 text-rose-600" />}
                        </button>
                      )
                    })}
                  </div>
                  {answerCorrect !== null && (
                    <div className={cn('mt-5 rounded-2xl border p-4 text-sm leading-6', answerCorrect ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10')}>
                      <p className="font-semibold">{answerCorrect ? 'Exactly.' : 'Not quite—try another answer.'}</p>
                      <p className="mt-1 text-foreground/75">{exercise.explanation}</p>
                    </div>
                  )}
                </div>
              )}

              {exercise.type === 'order' && (
                <div className="my-auto">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{exercise.prompt}</h1>
                  <p className="mt-2 text-sm text-muted-foreground">Tap the cards in the correct order.</p>
                  <div className="mt-6 min-h-48 rounded-2xl border border-dashed bg-muted/20 p-3">
                    {ordered.length === 0 ? (
                      <div className="grid min-h-40 place-items-center text-center text-sm text-muted-foreground">
                        Your sequence will appear here
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ordered.map((item, index) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => !orderChecked && setOrdered((current) => current.filter((entry) => entry !== item))}
                            className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left text-sm"
                          >
                            <span className={cn('grid size-7 place-items-center rounded-lg text-xs font-bold', accent.soft)}>{index + 1}</span>
                            <span className="flex-1">{item}</span>
                            <GripVertical className="size-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {availableOrderItems.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setOrdered((current) => [...current, item])}
                        className="w-full rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:border-foreground/25"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {!orderChecked && ordered.length === exercise.items.length && (
                    <Button className="mt-4 w-full" variant="outline" onClick={checkOrder} disabled={submitting}>Check sequence</Button>
                  )}
                  {orderChecked && (
                    <div className={cn('mt-4 rounded-2xl border p-4 text-sm', answerCorrect ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10')}>
                      <p className="font-semibold">{answerCorrect ? 'Sequence complete.' : 'That order misses the learning loop.'}</p>
                      <p className="mt-1 text-foreground/75">{exercise.explanation}</p>
                      {!answerCorrect && <Button className="mt-3" size="sm" variant="outline" onClick={retryOrder}><RotateCcw />Try again</Button>}
                    </div>
                  )}
                </div>
              )}

              {exercise.type === 'reflection' && (
                <div className="my-auto">
                  <div className={cn('mb-6 grid size-16 place-items-center rounded-2xl text-2xl', accent.soft)}>✍️</div>
                  <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{exercise.prompt}</h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Turning the concept into a specific decision helps it survive outside this lesson.</p>
                  <Textarea
                    className="mt-6 min-h-40 rounded-2xl p-4 text-base leading-7"
                    value={reflections[exercise.id] ?? ''}
                    onChange={(event) => setReflections((current) => ({ ...current, [exercise.id]: event.target.value }))}
                    placeholder={exercise.placeholder}
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {backendEnabled ? 'Saved securely when you complete the lesson.' : 'Saved on this device when you complete the lesson.'}
                  </p>
                </div>
              )}
            </motion.section>
          </AnimatePresence>

          <div className="mt-8 flex gap-3 border-t pt-4">
            {submissionError && (
              <p className="absolute -mt-8 text-xs text-destructive">{submissionError}</p>
            )}
            {stepIndex > 0 && (
              <Button variant="outline" size="lg" onClick={goBack} aria-label="Previous exercise"><ArrowLeft /></Button>
            )}
            <Button
              className={cn('flex-1', accent.button)}
              size="lg"
              onClick={continueLesson}
              disabled={!canContinue() || submitting}
            >
              {submitting ? 'Saving…' : stepIndex === lesson.exercises.length - 1 ? 'Complete lesson' : 'Continue'}
              {stepIndex === lesson.exercises.length - 1 ? <Check /> : <ArrowRight />}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

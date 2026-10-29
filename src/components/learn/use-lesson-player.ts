'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  submitLearningExercise,
  type ExerciseSubmissionResult,
} from '@/lib/learning-api'
import { completeLocalPathLesson } from '@/lib/learning-local'
import type { LearningProgress, PathLesson } from '@/lib/learning-paths'

export function useLessonPlayer(
  lesson: PathLesson,
  progress: LearningProgress,
  backendEnabled: boolean,
  userId?: string,
  persistPreview = true,
) {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [correct, setCorrect] = useState<boolean | null>(null)
  const [ordered, setOrdered] = useState<string[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [reflections, setReflections] = useState(progress.reflections)
  const [usedTools, setUsedTools] = useState<Set<string>>(() => new Set())
  const [complete, setComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExerciseSubmissionResult | null>(null)
  const completion = useRef<ExerciseSubmissionResult | null>(null)
  const lock = useRef(false)
  const exercise = lesson.exercises[step]

  function record(response: ExerciseSubmissionResult) {
    setMistakes(response.mistakes)
    if (response.completed && !completion.current?.rewarded)
      completion.current = response
    setResult(completion.current)
  }

  async function submit(response: Record<string, string | number | string[]>) {
    const responseResult = await submitLearningExercise(
      createClient(),
      lesson.id,
      exercise.id,
      response,
    )
    record(responseResult)
    return responseResult
  }

  async function run(operation: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setSaving(true)
    setError(null)
    try {
      await operation()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your progress. Please try again.',
      )
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  async function choose(index: number) {
    if (
      (exercise.type !== 'choice' && exercise.type !== 'scenario') ||
      correct ||
      lock.current
    )
      return
    await run(async () => {
      const response = backendEnabled
        ? await submit({ selectedIndex: index })
        : null
      const accepted = response
        ? response.correct
        : index === exercise.correctIndex
      setSelected(index)
      setCorrect(accepted)
      if (!backendEnabled && !accepted) setMistakes((n) => n + 1)
    })
  }

  async function checkOrder() {
    if (
      exercise.type !== 'order' ||
      ordered.length !== exercise.items.length ||
      lock.current
    )
      return
    await run(async () => {
      const response = backendEnabled ? await submit({ items: ordered }) : null
      const accepted = response
        ? response.correct
        : exercise.items.every((item, i) => item === ordered[i])
      setCorrect(accepted)
      setOrderChecked(true)
      if (!backendEnabled && !accepted) setMistakes((n) => n + 1)
    })
  }

  const canContinue =
    exercise.type === 'concept' ||
    ((exercise.type === 'choice' ||
      exercise.type === 'scenario' ||
      exercise.type === 'order') &&
      correct === true) ||
    (exercise.type === 'reflection' &&
      (reflections[exercise.id] ?? '').trim().length >= 3) ||
    (exercise.type === 'tool' && usedTools.has(exercise.id))

  function reset() {
    setSelected(null)
    setCorrect(null)
    setOrdered([])
    setOrderChecked(false)
    setError(null)
  }

  async function next() {
    if (!canContinue || complete || lock.current) return
    await run(async () => {
      if (
        backendEnabled &&
        (exercise.type === 'reflection' || exercise.type === 'tool')
      ) {
        const response = await submit(
          exercise.type === 'reflection'
            ? { text: reflections[exercise.id] ?? '' }
            : {},
        )
        if (!response.correct)
          throw new Error('Complete this exercise before continuing.')
      }
      if (step < lesson.exercises.length - 1) {
        setStep((n) => n + 1)
        reset()
        return
      }
      if (backendEnabled) {
        // Completion can arrive on an earlier graded exercise, before a closing concept.
        if (!completion.current?.completed)
          throw new Error(
            'Finish every interactive check before completing this lesson.',
          )
        setResult(completion.current)
      } else if (persistPreview) {
        if (!userId)
          throw new Error(
            'Sign in again to keep preview progress on this device.',
          )
        const ownReflections = Object.fromEntries(
          lesson.exercises
            .filter((e) => e.type === 'reflection')
            .map((e) => [e.id, reflections[e.id] ?? '']),
        )
        completeLocalPathLesson(
          lesson.id,
          Math.max(60, 100 - mistakes * 10),
          mistakes,
          ownReflections,
          userId,
        )
      }
      setComplete(true)
    })
  }

  return {
    step,
    exercise,
    selected,
    correct,
    ordered,
    orderChecked,
    mistakes,
    reflections,
    complete,
    saving,
    error,
    result,
    canContinue,
    choose,
    checkOrder,
    next,
    previous() {
      if (saving || step === 0) return
      setStep((n) => n - 1)
      reset()
    },
    setReflection(text: string) {
      setReflections((current) => ({ ...current, [exercise.id]: text }))
    },
    markToolUsed() {
      setUsedTools((current) => new Set(current).add(exercise.id))
    },
    addOrderItem(item: string) {
      if (!orderChecked && !saving)
        setOrdered((current) =>
          current.includes(item) ? current : [...current, item],
        )
    },
    removeOrderItem(item: string) {
      if (!orderChecked && !saving)
        setOrdered((current) => current.filter((x) => x !== item))
    },
    retryOrder() {
      if (!saving) {
        setOrdered([])
        setOrderChecked(false)
        setCorrect(null)
      }
    },
  }
}

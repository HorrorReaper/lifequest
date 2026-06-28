'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Zap, Coins, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { completeLessonQuiz } from '@/lib/lessons'
import { useUserStore } from '@/lib/stores/user-store'
import type { Lesson } from '@/lib/lessons'

interface LessonReaderProps {
  lesson: Lesson
  alreadyCompleted: boolean
}

export function LessonReader({ lesson, alreadyCompleted }: LessonReaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const addXp = useUserStore((s) => s.addXp)
  const setCoins = useUserStore((s) => s.setCoins)
  const reduceMotion = useReducedMotion()

  const totalSteps = lesson.steps.length // last step index = quiz
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(lesson.quiz.length).fill(null)
  )
  const [submitted, setSubmitted] = useState(false)
  const [passed, setPassed] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState(alreadyCompleted)

  const isQuizStep = step === totalSteps
  const progress = (step / (totalSteps + 1)) * 100

  const stepVariants = reduceMotion
    ? { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 32 : -32 }),
        center: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -32 : 32 }),
      }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  function handleAnswer(qIdx: number, optIdx: number) {
    if (submitted) return
    setAnswers((prev) => {
      const next = [...prev]
      next[qIdx] = optIdx
      return next
    })
  }

  async function handleSubmit() {
    setSubmitted(true)
    const allCorrect = lesson.quiz.every((q, i) => answers[i] === q.correctIndex)

    if (allCorrect) {
      if (alreadyCompleted) {
        setPassed(true)
      } else {
        setCompleting(true)
        try {
          const { data: userData } = await supabase.auth.getUser()
          const user = userData?.user
          if (user) {
            await completeLessonQuiz(supabase, lesson, { addXp, setCoins })
            setPassed(true)
            setDone(true)
          }
        } finally {
          setCompleting(false)
        }
      }
    }
  }

  function handleRetry() {
    setAnswers(new Array(lesson.quiz.length).fill(null))
    setSubmitted(false)
    setPassed(false)
  }

  const allAnswered = answers.every((a) => a !== null)

  // Success screen
  if (done && passed) {
    return (
      <div className="min-h-svh bg-background flex items-center justify-center p-4 pb-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          className="max-w-sm w-full rounded-2xl border p-8 text-center space-y-5"
        >
          <div className="flex justify-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="size-8 text-green-500" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Lesson Complete!</h2>
            <p className="text-sm text-muted-foreground">{lesson.title}</p>
          </div>
          {!alreadyCompleted && (
            <div className="flex items-center justify-center gap-4 rounded-xl bg-muted px-6 py-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                <Zap className="size-4" /> +{lesson.xp_reward} XP
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                <Coins className="size-4" /> +{lesson.coin_reward}
              </span>
            </div>
          )}
          <Button className="w-full" onClick={() => router.push('/learn')}>
            Back to Lessons
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background pb-20">
      {/* Hero image */}
      <div className="relative w-full h-48 sm:h-64 bg-muted">
        <Image
          src={lesson.image}
          alt={lesson.title}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="px-2" onClick={() => router.push('/learn')}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{lesson.title}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {step + 1} / {totalSteps + 1}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>

        {/* Content */}
        <div className="overflow-hidden">
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
              {!isQuizStep ? (
                /* Article step */
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">{lesson.steps[step].title}</h2>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_strong]:text-foreground [&_ul]:text-sm [&_ol]:text-sm [&_li]:leading-relaxed [&_h3]:text-base [&_h3]:font-semibold [&_blockquote]:border-l-primary/50 [&_blockquote]:text-muted-foreground">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        img: ({ src, alt }) => (
                          <span className="block relative w-full h-44 my-4 overflow-hidden rounded-xl">
                            <Image
                              src={typeof src === 'string' ? src : ''}
                              alt={alt ?? ''}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 640px"
                            />
                          </span>
                        ),
                      }}
                    >
                      {lesson.steps[step].content}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                /* Quiz step */
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold">Quick Quiz</h2>
                    <p className="text-sm text-muted-foreground">
                      Answer all questions correctly to complete the lesson.
                    </p>
                  </div>

                  <div className="space-y-6">
                    {lesson.quiz.map((q, qIdx) => (
                      <div key={qIdx} className="space-y-3">
                        <p className="text-sm font-semibold">
                          {qIdx + 1}. {q.question}
                        </p>
                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => {
                            const selected = answers[qIdx] === optIdx
                            const isCorrect = optIdx === q.correctIndex
                            const isWrong = submitted && selected && !isCorrect
                            const showCorrect = submitted && isCorrect

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleAnswer(qIdx, optIdx)}
                                disabled={submitted || alreadyCompleted}
                                className={cn(
                                  'w-full text-left rounded-xl border px-4 py-3 text-sm transition-all',
                                  !submitted && selected && 'border-primary bg-primary/5',
                                  !submitted && !selected && 'hover:border-foreground/30',
                                  showCorrect && 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
                                  isWrong && 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                )}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                        {submitted && answers[qIdx] !== q.correctIndex && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            Correct answer: {q.options[q.correctIndex]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {!alreadyCompleted && !passed && (
                    <div className="space-y-2">
                      {!submitted ? (
                        <Button
                          className="w-full"
                          onClick={handleSubmit}
                          disabled={!allAnswered || completing}
                        >
                          Submit Quiz
                        </Button>
                      ) : (
                        <Button className="w-full" variant="outline" onClick={handleRetry}>
                          Try Again
                        </Button>
                      )}
                    </div>
                  )}

                  {alreadyCompleted && (
                    <p className="text-center text-sm text-green-600 dark:text-green-400 font-medium">
                      ✓ You already completed this lesson
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        {!isQuizStep && (
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => goTo(step - 1)}>
                <ChevronLeft className="size-4 mr-1" /> Back
              </Button>
            )}
            <Button className="flex-1" onClick={() => goTo(step + 1)}>
              {step === totalSteps - 1 ? 'Take the Quiz' : 'Next'}
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        )}

        {isQuizStep && !passed && (
          <Button variant="ghost" size="sm" onClick={() => goTo(totalSteps - 1)}>
            <ChevronLeft className="size-4 mr-1" /> Back to lesson
          </Button>
        )}
      </div>
    </div>
  )
}

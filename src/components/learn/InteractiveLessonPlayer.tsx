'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Check,
  ChevronRight,
  CircleCheck,
  FlaskConical,
  Lightbulb,
  RotateCcw,
  Workflow,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  getNextLessonId,
  type LearningCatalog,
  type LearningPath,
  type LearningPerspective,
  type LearningProgress,
  type PathLesson,
} from '@/lib/learning-paths'
import { PERSONAL_PATH_ID } from '@/lib/personal-learning'
import { LessonToolExercise } from './LessonToolExercise'
import { LearningBlocks } from './LearningBlocks'
import { useLessonPlayer } from './use-lesson-player'
import styles from './academy.module.css'

interface Props {
  catalog: LearningCatalog
  path: LearningPath
  lesson: PathLesson
  progress: LearningProgress
  backendEnabled: boolean
  userId?: string
  draftPreview?: boolean
}

export function InteractiveLessonPlayer({
  catalog,
  path,
  lesson,
  progress,
  backendEnabled,
  userId,
  draftPreview = false,
}: Props) {
  const player = useLessonPlayer(
    lesson,
    progress,
    backendEnabled,
    userId,
    !draftPreview,
  )
  const [perspective, setPerspective] = useState<LearningPerspective>('product')
  const heading = useRef<HTMLHeadingElement>(null)
  const personal = path.id === PERSONAL_PATH_ID
  const { exercise } = player
  const nextLessonId = getNextLessonId(catalog, lesson.id)
  const courseHref = `/learn/courses/${path.id}`
  const percentage = Math.round(
    ((player.step + (player.complete ? 1 : 0)) / lesson.exercises.length) * 100,
  )
  const labels = personal
    ? {
        concept: 'Verstehen',
        choice: 'Kurz prüfen',
        scenario: 'Anwenden',
        order: 'In Reihenfolge bringen',
        reflection: 'Dein Transfer',
        tool: 'Praktisch anwenden',
      }
    : {
        concept: 'Understand',
        choice: 'Quick check',
        scenario: 'Apply it',
        order: 'Build the sequence',
        reflection: 'Make it yours',
        tool: 'Use the tool',
      }
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [player.step, player.complete])

  const toggle = (
    <div className={styles.perspectives} role="group" aria-label="Praxisfall">
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={perspective === 'product'}
        onClick={() => setPerspective('product')}
      >
        <Blocks />
        Eigenes Produkt
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={perspective === 'company'}
        onClick={() => setPerspective('company')}
      >
        <Workflow />
        Unternehmen verbessern
      </Button>
    </div>
  )

  return (
    <div className={styles.academy} lang={personal ? 'de' : 'en'}>
      <header className={styles.playerHeader}>
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={draftPreview ? '/admin/learning' : courseHref}
            aria-label={
              personal ? 'Zurück zur Kursübersicht' : 'Back to course'
            }
          >
            <X />
          </Link>
        </Button>
        <div
          className={styles.track}
          role="progressbar"
          aria-label={personal ? 'Lektionsfortschritt' : 'Lesson progress'}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={styles.trackFill}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={styles.stepLabel}>
          {Math.min(player.step + 1, lesson.exercises.length)} /{' '}
          {lesson.exercises.length}
        </span>
      </header>
      <main className={styles.player}>
        <nav className={styles.playerContext} aria-label="Breadcrumb">
          <Link href={courseHref}>{path.shortTitle}</Link>
          <ChevronRight />
          <span>{lesson.title}</span>
        </nav>
        {!backendEnabled && (
          <p className={styles.notice}>
            <FlaskConical />
            {personal
              ? 'Kursvorschau · Fortschritt nur auf diesem Gerät · keine XP oder Coins'
              : 'Preview · progress on this device only · no XP or coins'}
          </p>
        )}
        {player.complete ? (
          <section className={styles.completion}>
            <div className={styles.completionIcon}>
              <Check />
            </div>
            <p className={styles.eyebrow}>
              {personal ? 'Lektion abgeschlossen' : 'Lesson completed'}
            </p>
            <h1 className={styles.playerTitle} ref={heading} tabIndex={-1}>
              {personal
                ? 'Ein klarerer Blick. Ein nächster Schritt.'
                : lesson.title}
            </h1>
            <p className={styles.body}>
              {personal
                ? 'Du hast die Idee geprüft und mit deinem eigenen Vorhaben verbunden.'
                : 'You checked the idea and turned it into a concrete next step.'}
            </p>
            {lesson.exercises
              .filter((e) => e.type === 'reflection')
              .map(
                (e) =>
                  player.reflections[e.id] && (
                    <div key={e.id} className={styles.completionNote}>
                      <p className={styles.eyebrow}>
                        {personal ? 'Dein Ergebnis' : 'Your reflection'}
                      </p>
                      <p className="mt-3">{player.reflections[e.id]}</p>
                    </div>
                  ),
              )}
            {backendEnabled && player.result && (
              <p className={styles.hint}>
                {player.result.rewarded
                  ? `+${player.result.xpAwarded} XP · +${player.result.coinsAwarded} coins`
                  : personal
                    ? 'Für diesen Abschluss wurden bereits Belohnungen vergeben.'
                    : 'This lesson was already rewarded.'}
              </p>
            )}
            <div className={styles.completionActions}>
              {nextLessonId && !draftPreview && (
                <Button className={styles.primary} asChild>
                  <Link href={`/learn/${nextLessonId}`}>
                    {personal ? 'Nächste Lektion' : 'Next lesson'}
                    <ArrowRight />
                  </Link>
                </Button>
              )}
              <Button className={styles.outline} variant="outline" asChild>
                <Link href={draftPreview ? '/admin/learning' : courseHref}>
                  {personal ? 'Zurück zum Lernpfad' : 'Back to the course'}
                </Link>
              </Button>
            </div>
          </section>
        ) : (
          <>
            <p className={styles.eyebrow}>
              {exercise.type === 'reflection' && exercise.practiceMinutes
                ? `Praxisaufgabe · ca. ${exercise.practiceMinutes} min · ${exercise.practiceMinutes >= 120 ? 'mehrere Sitzungen' : 'separat zur Kurzlektion'}`
                : labels[exercise.type]}
            </p>
            <h1 ref={heading} tabIndex={-1} className={styles.playerTitle}>
              {exercise.type === 'concept' ? exercise.title : exercise.prompt}
            </h1>
            {exercise.type === 'concept' && (
              <>
                <p className={styles.body}>{exercise.body}</p>
                {exercise.perspectives && (
                  <>
                    {toggle}
                    <div className={styles.story}>
                      <small>
                        {perspective === 'product'
                          ? 'AUS DEINEM PRODUKTALLTAG'
                          : 'AUS DEM UNTERNEHMENSALLTAG'}
                      </small>
                      <p>{exercise.perspectives[perspective].body}</p>
                    </div>
                    <LearningBlocks
                      blocks={exercise.perspectives[perspective].blocks}
                    />
                  </>
                )}
                <LearningBlocks blocks={exercise.blocks} />
                <div className={styles.key}>
                  <Lightbulb />
                  <p>{exercise.takeaway}</p>
                </div>
              </>
            )}
            {(exercise.type === 'choice' || exercise.type === 'scenario') && (
              <>
                {exercise.type === 'scenario' && (
                  <p className={styles.story}>{exercise.context}</p>
                )}
                <div className={styles.answers}>
                  {exercise.options.map((option, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={player.selected === i}
                      aria-label={`${String.fromCharCode(65 + i)} ${option}`}
                      disabled={player.saving || player.correct === true}
                      onClick={() => player.choose(i)}
                      className={cn(
                        styles.answer,
                        player.selected === i &&
                          (player.correct ? styles.correct : styles.incorrect),
                      )}
                    >
                      <span className={styles.answerLetter}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {player.selected === i &&
                        (player.correct ? (
                          <CircleCheck className="size-5 shrink-0" />
                        ) : (
                          <X className="size-5 shrink-0" />
                        ))}
                    </button>
                  ))}
                </div>
                <div aria-live="polite">
                  {player.correct !== null && (
                    <div className={styles.feedback}>
                      <strong>
                        {personal
                          ? player.correct
                            ? 'Genau. Gut erkannt.'
                            : 'Hier lohnt sich ein zweiter Blick.'
                          : player.correct
                            ? 'Exactly.'
                            : 'Not quite. Try again.'}
                      </strong>
                      <p>{exercise.explanation}</p>
                    </div>
                  )}
                </div>
              </>
            )}
            {exercise.type === 'order' && (
              <>
                <p className={styles.hint}>
                  {personal
                    ? 'Wähle die Schritte in der richtigen Reihenfolge. Tippe einen gewählten Schritt an, um ihn zu entfernen.'
                    : 'Select the steps in order. Select a chosen step to remove it.'}
                </p>
                <div className={styles.orderArea}>
                  <div className={styles.orderItems}>
                    {player.ordered.map((item, i) => (
                      <Button
                        variant="outline"
                        className={styles.outline}
                        key={item}
                        onClick={() => player.removeOrderItem(item)}
                        disabled={player.saving || player.orderChecked}
                      >
                        {i + 1}. {item}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className={styles.orderItems}>
                  {(backendEnabled
                    ? exercise.items
                    : [...exercise.items.slice(1), exercise.items[0]]
                  )
                    .filter((item) => !player.ordered.includes(item))
                    .map((item) => (
                      <Button
                        variant="outline"
                        className={styles.outline}
                        key={item}
                        onClick={() => player.addOrderItem(item)}
                        disabled={player.saving || player.orderChecked}
                      >
                        {item}
                      </Button>
                    ))}
                </div>
                {!player.orderChecked &&
                  player.ordered.length === exercise.items.length && (
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={player.checkOrder}
                      disabled={player.saving}
                    >
                      {personal ? 'Reihenfolge prüfen' : 'Check sequence'}
                    </Button>
                  )}
                {player.orderChecked && (
                  <div
                    className={cn(styles.feedback, 'mt-4')}
                    aria-live="polite"
                  >
                    <strong>
                      {player.correct
                        ? '✓'
                        : personal
                          ? 'Versuche es noch einmal.'
                          : 'Try again.'}
                    </strong>
                    <p>{exercise.explanation}</p>
                    {!player.correct && (
                      <Button
                        className="mt-3"
                        variant="outline"
                        onClick={player.retryOrder}
                        disabled={player.saving}
                      >
                        <RotateCcw />
                        {personal ? 'Erneut versuchen' : 'Try again'}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
            {exercise.type === 'reflection' && (
              <>
                {personal && toggle}
                <label
                  className="sr-only"
                  htmlFor={`reflection-${exercise.id}`}
                >
                  {exercise.prompt}
                </label>
                <Textarea
                  id={`reflection-${exercise.id}`}
                  className={styles.textarea}
                  value={player.reflections[exercise.id] ?? ''}
                  onChange={(event) => player.setReflection(event.target.value)}
                  placeholder={exercise.placeholder}
                  maxLength={12000}
                  readOnly={backendEnabled && !!progress.completions[lesson.id]}
                />
                <p className={styles.hint}>
                  {backendEnabled && progress.completions[lesson.id]
                    ? personal
                      ? 'Deine gespeicherte Reflexion aus dieser abgeschlossenen Lektion.'
                      : 'Your saved reflection from this completed lesson.'
                    : backendEnabled
                      ? personal
                        ? 'Wird beim Weitergehen in deinem Konto gespeichert.'
                        : 'Saved to your account when you continue.'
                      : personal
                        ? 'Wird beim Abschluss als Vorschau auf diesem Gerät gespeichert.'
                        : 'Saved on this device when you finish the preview.'}
                </p>
              </>
            )}
            {exercise.type === 'tool' && draftPreview && (
              <div className={styles.feedback}>
                <p>
                  Draft preview: the tool is not opened and no tool entries are
                  changed.
                </p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={player.markToolUsed}
                >
                  Preview tool step
                </Button>
              </div>
            )}
            {exercise.type === 'tool' && !draftPreview && (
              <LessonToolExercise
                key={exercise.id}
                exercise={exercise}
                showHeading={false}
                accentSoft="bg-muted text-foreground"
                onUsed={player.markToolUsed}
              />
            )}
            {player.error && (
              <p className={styles.error} role="alert">
                {player.error}
              </p>
            )}
            <footer className={styles.playerFooter}>
              <Button
                variant="ghost"
                onClick={player.previous}
                disabled={player.step === 0 || player.saving}
              >
                <ArrowLeft />
                {personal ? 'Zurück' : 'Back'}
              </Button>
              <Button
                className={styles.primary}
                onClick={player.next}
                disabled={!player.canContinue || player.saving}
              >
                {player.saving
                  ? personal
                    ? 'Wird gespeichert…'
                    : 'Saving…'
                  : player.step === lesson.exercises.length - 1
                    ? personal
                      ? 'Festhalten & abschließen'
                      : 'Complete lesson'
                    : personal
                      ? 'Weiter'
                      : 'Continue'}
                {player.step === lesson.exercises.length - 1 ? (
                  <Check />
                ) : (
                  <ArrowRight />
                )}
              </Button>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

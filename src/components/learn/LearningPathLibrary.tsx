'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  Blocks,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  FlaskConical,
  Hammer,
  Layers,
  LockKeyhole,
  NotebookPen,
  Play,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getPathLessons,
  isLessonUnlocked,
  type LearningCatalog,
  type LearningPathId,
  type LearningProgress,
} from '@/lib/learning-paths'
import {
  PERSONAL_PATH_ID,
  withPersonalLearningPath,
} from '@/lib/personal-learning'
import type { LessonWithStatus } from '@/lib/lessons'
import { LessonCard } from './LessonCard'
import { CourseCover } from './CourseCover'
import styles from './academy.module.css'
import {
  mergePreviewProgress,
  usePreviewProgress,
} from './use-preview-progress'

interface Props {
  catalog: LearningCatalog
  progress: LearningProgress
  backendEnabled: boolean
  legacyLessons: LessonWithStatus[]
  publishedPathIds?: LearningPathId[]
  initialPathId?: LearningPathId
  userId?: string
}

export function LearningPathLibrary({
  catalog: initialCatalog,
  progress: syncedProgress,
  backendEnabled,
  legacyLessons,
  publishedPathIds = [],
  initialPathId,
  userId,
}: Props) {
  const catalog = withPersonalLearningPath(initialCatalog)
  const localProgress = usePreviewProgress(userId)
  const progress = mergePreviewProgress(
    catalog,
    syncedProgress,
    localProgress,
    publishedPathIds,
  )
  const [selectedId, setSelectedId] = useState(
    initialPathId ?? PERSONAL_PATH_ID,
  )
  const [openUnit, setOpenUnit] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const path =
    catalog.paths.find((item) => item.id === selectedId) ?? catalog.paths[0]
  const personal = path.id === PERSONAL_PATH_ID
  const published = backendEnabled && publishedPathIds.includes(path.id)
  const lessons = getPathLessons(path)
  const completed = lessons.filter(
    (lesson) => progress.completions[lesson.id],
  ).length
  const next = lessons.find(
    (lesson) =>
      !progress.completions[lesson.id] &&
      isLessonUnlocked(path, lesson.id, progress),
  )
  const target = next ?? lessons[0]
  function choose(id: LearningPathId) {
    setSelectedId(id)
    setOpenUnit(0)
    setShowAll(false)
  }

  return (
    <div className={styles.academy} lang={personal ? 'de' : 'en'}>
      <div className={styles.page}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link href="/learn">Academy</Link>
          <ChevronRight />
          <span>{personal ? 'Dein Lernpfad' : path.title}</span>
          <span className="ml-auto inline-flex items-center gap-1">
            <LockKeyhole />
            {personal ? 'Privater Lernbereich' : 'Admin academy'}
          </span>
        </nav>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>
              {personal ? 'Dein persönlicher Kurs' : 'LifeQuest Academy'}
            </p>
            <h1 className={styles.title}>
              {personal ? (
                <>
                  Unternehmerisch denken.
                  <br />
                  Mit Technologie gestalten.
                </>
              ) : (
                path.title
              )}
            </h1>
            <p className={styles.description}>{path.description}</p>
            <div className={styles.meta}>
              <span>
                <Layers />
                {path.units.length} {personal ? 'Module' : 'units'}
              </span>
              <span>
                <BookOpen />
                {lessons.length} {personal ? 'Lektionen' : 'lessons'}
              </span>
              {personal && (
                <span>
                  <Hammer />
                  {path.units.length} Praxisaufgaben
                </span>
              )}
            </div>
          </div>
          {personal && <CourseCover />}
        </header>
        {!published && (
          <p className={styles.notice} role="status">
            <FlaskConical />
            <span>
              {personal
                ? 'Kursvorschau: Dieser Kurs ist noch nicht veröffentlicht oder die Verbindung ist nicht verfügbar. Vorschau-Fortschritt bleibt auf diesem Gerät; es werden keine XP oder Coins vergeben.'
                : 'Preview: this course is unavailable from the backend. Preview progress stays on this device and awards no XP or coins.'}{' '}
              <Link
                className="underline underline-offset-4"
                href="/admin/learning"
              >
                {personal ? 'Learning Studio öffnen' : 'Open Learning Studio'}
              </Link>
            </span>
          </p>
        )}
        <section
          className={styles.continue}
          aria-label={personal ? 'Nächste Lektion' : 'Next lesson'}
        >
          <div>
            <small>
              {personal
                ? completed === lessons.length
                  ? 'KURS ABGESCHLOSSEN'
                  : 'DEIN NÄCHSTER SCHRITT'
                : 'YOUR NEXT STEP'}
            </small>
            <h2>{target.title}</h2>
            <p className={styles.continueMeta}>
              <Clock3 />
              {target.estimatedMinutes} {personal ? 'Minuten' : 'minutes'}
              <span>·</span>
              {personal ? 'Eine Idee. Zwei Perspektiven.' : path.outcome}
            </p>
          </div>
          <Button className={styles.lightButton} size="lg" asChild>
            <Link href={`/learn/${target.id}`}>
              {personal
                ? completed === lessons.length
                  ? 'Noch einmal ansehen'
                  : completed
                    ? 'Weiterlernen'
                    : 'Lektion starten'
                : completed
                  ? 'Continue learning'
                  : 'Start lesson'}
              <ArrowRight />
            </Link>
          </Button>
        </section>
        <div className={styles.columns}>
          <section>
            <div className={styles.sectionHead}>
              <h2 className={styles.heading}>
                {personal ? 'Dein Lernpfad' : 'Your learning path'}
              </h2>
              <small>
                {completed} / {lessons.length}{' '}
                {personal ? 'Lektionen' : 'lessons'}
              </small>
            </div>
            <div className={styles.modules}>
              {path.units
                .slice(0, showAll ? undefined : 4)
                .map((unit, index) => (
                  <div
                    key={unit.id}
                    className={cn(
                      styles.module,
                      openUnit === index && styles.active,
                    )}
                  >
                    <button
                      type="button"
                      className={styles.moduleToggle}
                      onClick={() =>
                        setOpenUnit(openUnit === index ? -1 : index)
                      }
                      aria-expanded={openUnit === index}
                  aria-label={`${String(index + 1).padStart(2, '0')} ${unit.title}`}
                      aria-controls={`unit-${unit.id}`}
                    >
                      <span className={styles.moduleIndex}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={styles.moduleName}>
                        <strong>{unit.title}</strong>
                        <small>
                          {unit.lessons.length}{' '}
                          {personal ? 'Lektionen · 1 Praxisaufgabe' : 'lessons'}
                        </small>
                      </span>
                      {openUnit === index ? <ChevronUp /> : <ChevronDown />}
                    </button>
                    <div
                      id={`unit-${unit.id}`}
                      hidden={openUnit !== index}
                      className={styles.lessons}
                    >
                      {unit.lessons.map((lesson) => {
                        const done = !!progress.completions[lesson.id]
                        const unlocked = isLessonUnlocked(
                          path,
                          lesson.id,
                          progress,
                        )
                        const content = (
                          <>
                            {done ? (
                              <Check />
                            ) : unlocked ? (
                              <Play />
                            ) : (
                              <LockKeyhole />
                            )}
                            <span>{lesson.title}</span>
                            <small>{lesson.estimatedMinutes} min</small>
                          </>
                        )
                        return unlocked ? (
                          <Link
                            key={lesson.id}
                            className={cn(styles.lessonRow, styles.available)}
                            href={`/learn/${lesson.id}`}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div
                            key={lesson.id}
                            className={cn(styles.lessonRow, styles.locked)}
                            aria-label={`${lesson.title} · ${personal ? 'Noch gesperrt' : 'Locked'}`}
                          >
                            {content}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
            {path.units.length > 4 && (
              <Button
                variant="ghost"
                className="mt-3"
                onClick={() => setShowAll(!showAll)}
                aria-expanded={showAll}
              >
                {showAll
                  ? 'Weniger Module anzeigen'
                  : `Weitere ${path.units.length - 4} Module anzeigen`}
                <ArrowDown />
              </Button>
            )}
          </section>
          <aside>
            <p className={styles.eyebrow}>
              {personal ? 'Lernen durch Anwenden' : 'Learn by doing'}
            </p>
            <h2 className={styles.asideTitle}>
              {personal ? (
                <>
                  Zwei Perspektiven.
                  <br />
                  Ein Lernpfad.
                </>
              ) : (
                'Make the ideas your own.'
              )}
            </h2>
            <p className={styles.asideText}>
              {personal
                ? 'Jedes Modul verbindet eine Produktidee mit einem konkreten Problem im Unternehmen.'
                : path.outcome}
            </p>
            {personal && (
              <>
                <div className={styles.case}>
                  <Blocks />
                  <div>
                    <h3>Ein eigenes Produkt</h3>
                    <p>
                      Eine kleine Idee für LifeQuest entwickeln und mit echten
                      Kriterien prüfen.
                    </p>
                  </div>
                </div>
                <div className={styles.case}>
                  <Workflow />
                  <div>
                    <h3>Ein besserer Prozess</h3>
                    <p>
                      Wiederkehrende Arbeit verstehen und sinnvoll mit AI
                      unterstützen.
                    </p>
                  </div>
                </div>
              </>
            )}
            <p className={styles.asideFooter}>
              <NotebookPen />
              {personal
                ? 'Aus jeder Praxisaufgabe entsteht etwas, das du weiterverwenden kannst.'
                : 'Turn each idea into a specific decision and a next step.'}
            </p>
          </aside>
        </div>
        <section className={styles.otherCourses}>
          <h2 className={styles.heading}>
            {personal ? 'Weitere Lernpfade' : 'Learning paths'}
          </h2>
          <div className={styles.courseChoices}>
            {catalog.paths.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.courseChoice}
                aria-pressed={path.id === item.id}
                onClick={() => choose(item.id)}
              >
                {item.shortTitle}
              </button>
            ))}
          </div>
        </section>
        {legacyLessons.length > 0 && (
          <details className={styles.archive}>
            <summary>
              {personal ? 'Artikelbibliothek' : 'Foundation articles'} ·{' '}
              {legacyLessons.length}
            </summary>
            <div className={styles.archiveList}>
              {legacyLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Clipboard,
  Eye,
  FileJson,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  DEFAULT_LEARNING_CATALOG,
  getPathLessons,
  validateLearningCatalog,
  type LearningCatalog,
  type LearningExercise,
  type LearningPath,
  type LearningUnit,
  type PathLesson,
} from '@/lib/learning-paths'
import {
  readLocalLearningCatalog,
  resetLocalLearningCatalog,
  writeLocalLearningCatalog,
} from '@/lib/learning-local'
import { createClient } from '@/lib/supabase/client'
import { TOOL_REGISTRY } from '@/lib/tools/registry'
import {
  fetchAdminLearningCatalog,
  publishAdminLearningCatalog,
  saveAdminLearningCatalog,
} from '@/lib/learning-api'

type Notice = { tone: 'success' | 'error'; message: string } | null

function draftId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`
}

function newLesson(): PathLesson {
  const lessonId = draftId('lesson')
  return {
    id: lessonId,
    title: 'Untitled lesson',
    description: 'Describe the decision or skill this lesson develops.',
    icon: '✨',
    difficulty: 'foundation',
    estimatedMinutes: 5,
    masteryPoints: 100,
    exercises: [
      {
        id: `${lessonId}-concept`,
        type: 'concept',
        title: 'The core idea',
        body: 'Explain one useful mental model in plain language.',
        takeaway: 'Write the principle the learner should remember.',
      },
    ],
  }
}

function newExercise(type: LearningExercise['type']): LearningExercise {
  const id = draftId(type)
  switch (type) {
    case 'concept':
      return { id, type, title: 'New concept', body: 'Explain the idea.', takeaway: 'State the key takeaway.' }
    case 'choice':
      return { id, type, prompt: 'What is the best answer?', options: ['Correct answer', 'Distractor'], correctIndex: 0, explanation: 'Explain why.' }
    case 'scenario':
      return { id, type, context: 'Describe a realistic situation.', prompt: 'What should the learner do?', options: ['Correct response', 'Distractor'], correctIndex: 0, explanation: 'Explain the decision.' }
    case 'order':
      return { id, type, prompt: 'Put these steps in order.', items: ['First step', 'Second step'], explanation: 'Explain the sequence.' }
    case 'reflection':
      return { id, type, prompt: 'How will you apply this?', placeholder: 'Write a specific next action.' }
    case 'tool':
      return {
        id,
        type,
        toolId: TOOL_REGISTRY[0]?.id ?? '',
        prompt: 'Use the tool to put this into practice.',
      }
  }
}

export function LearningStudio() {
  const [catalog, setCatalog] = useState<LearningCatalog>(DEFAULT_LEARNING_CATALOG)
  const [selectedPathId, setSelectedPathId] = useState(DEFAULT_LEARNING_CATALOG.paths[0].id)
  const [selectedUnitId, setSelectedUnitId] = useState(DEFAULT_LEARNING_CATALOG.paths[0].units[0].id)
  const [selectedLessonId, setSelectedLessonId] = useState(DEFAULT_LEARNING_CATALOG.paths[0].units[0].lessons[0].id)
  const [notice, setNotice] = useState<Notice>(null)
  const [dirty, setDirty] = useState(false)
  const [showJson, setShowJson] = useState(false)
  const [jsonDraft, setJsonDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [changeSummary, setChangeSummary] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const stored = await fetchAdminLearningCatalog(createClient())
        setCatalog(stored)
        const firstPath = stored.paths[0]
        const firstUnit = firstPath?.units[0]
        const firstLesson = firstUnit?.lessons[0]
        if (firstPath) setSelectedPathId(firstPath.id)
        if (firstUnit) setSelectedUnitId(firstUnit.id)
        if (firstLesson) setSelectedLessonId(firstLesson.id)
      } catch (error) {
        const fallback = readLocalLearningCatalog()
        setCatalog(fallback)
        setNotice({
          tone: 'error',
          message: error instanceof Error
            ? `Database catalog unavailable: ${error.message}`
            : 'Database catalog unavailable.',
        })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const selectedPath = catalog.paths.find((path) => path.id === selectedPathId) ?? catalog.paths[0]
  const selectedUnit = selectedPath?.units.find((unit) => unit.id === selectedUnitId) ?? selectedPath?.units[0]
  const selectedLesson = selectedUnit?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? selectedUnit?.lessons[0]
  const totalLessons = useMemo(
    () => catalog.paths.reduce((total, path) => total + getPathLessons(path).length, 0),
    [catalog]
  )
  const totalExercises = useMemo(
    () =>
      catalog.paths.reduce(
        (total, path) =>
          total + getPathLessons(path).reduce((pathTotal, lesson) => pathTotal + lesson.exercises.length, 0),
        0
      ),
    [catalog]
  )

  function changeCatalog(next: LearningCatalog) {
    setCatalog(next)
    setDirty(true)
    setNotice(null)
  }

  function updatePath(transform: (path: LearningPath) => LearningPath) {
    changeCatalog({
      ...catalog,
      paths: catalog.paths.map((path) => path.id === selectedPath.id ? transform(path) : path),
    })
  }

  function updateUnit(transform: (unit: LearningUnit) => LearningUnit) {
    updatePath((path) => ({
      ...path,
      units: path.units.map((unit) => unit.id === selectedUnit.id ? transform(unit) : unit),
    }))
  }

  function updateLesson(transform: (lesson: PathLesson) => PathLesson) {
    updateUnit((unit) => ({
      ...unit,
      lessons: unit.lessons.map((lesson) => lesson.id === selectedLesson.id ? transform(lesson) : lesson),
    }))
  }

  function updateExercise(id: string, transform: (exercise: LearningExercise) => LearningExercise) {
    updateLesson((lesson) => ({
      ...lesson,
      exercises: lesson.exercises.map((exercise) => exercise.id === id ? transform(exercise) : exercise),
    }))
  }

  function choosePath(path: LearningPath) {
    setSelectedPathId(path.id)
    const firstUnit = path.units[0]
    const firstLesson = firstUnit?.lessons[0]
    if (firstUnit) setSelectedUnitId(firstUnit.id)
    if (firstLesson) setSelectedLessonId(firstLesson.id)
  }

  function chooseUnit(unit: LearningUnit) {
    setSelectedUnitId(unit.id)
    if (unit.lessons[0]) setSelectedLessonId(unit.lessons[0].id)
  }

  function addUnit() {
    const unit: LearningUnit = {
      id: draftId('unit'),
      title: 'New unit',
      description: 'Describe the capability this unit develops.',
      lessons: [newLesson()],
    }
    updatePath((path) => ({ ...path, units: [...path.units, unit] }))
    setSelectedUnitId(unit.id)
    setSelectedLessonId(unit.lessons[0].id)
  }

  function addLesson() {
    const lesson = newLesson()
    updateUnit((unit) => ({ ...unit, lessons: [...unit.lessons, lesson] }))
    setSelectedLessonId(lesson.id)
  }

  function removeLesson() {
    if (selectedUnit.lessons.length === 1) {
      setNotice({ tone: 'error', message: 'A unit must keep at least one lesson.' })
      return
    }
    if (!window.confirm(`Delete “${selectedLesson.title}” from this browser draft?`)) return
    const nextLessons = selectedUnit.lessons.filter((lesson) => lesson.id !== selectedLesson.id)
    updateUnit((unit) => ({ ...unit, lessons: nextLessons }))
    setSelectedLessonId(nextLessons[0].id)
  }

  function removeExercise(exerciseId: string) {
    if (selectedLesson.exercises.length === 1) {
      setNotice({ tone: 'error', message: 'A lesson must keep at least one exercise.' })
      return
    }
    updateLesson((lesson) => ({
      ...lesson,
      exercises: lesson.exercises.filter((exercise) => exercise.id !== exerciseId),
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await saveAdminLearningCatalog(createClient(), catalog, changeSummary)
      setCatalog(saved)
      writeLocalLearningCatalog(saved)
      setDirty(false)
      setNotice({ tone: 'success', message: 'Draft saved to Supabase. Publish when it is ready for learners.' })
      return true
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not save the catalog.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    setPublishing(true)
    try {
      if (dirty && !(await save())) return
      const published = await publishAdminLearningCatalog(createClient(), changeSummary)
      setCatalog(published)
      writeLocalLearningCatalog(published)
      setDirty(false)
      setChangeSummary('')
      setNotice({ tone: 'success', message: 'Published. New learners now receive this curriculum version.' })
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not publish the catalog.' })
    } finally {
      setPublishing(false)
    }
  }

  function reset() {
    if (!window.confirm('Replace this unsaved draft with the authored defaults?')) return
    resetLocalLearningCatalog()
    const defaults = structuredClone(DEFAULT_LEARNING_CATALOG)
    setCatalog(defaults)
    choosePath(defaults.paths[0])
    setDirty(false)
    setDirty(true)
    setNotice({ tone: 'success', message: 'Authored defaults loaded. Save to keep them as the database draft.' })
  }

  async function copyJson() {
    const serialized = JSON.stringify(catalog, null, 2)
    try {
      await navigator.clipboard.writeText(serialized)
      setNotice({ tone: 'success', message: 'Catalog JSON copied to the clipboard.' })
    } catch {
      setJsonDraft(serialized)
      setShowJson(true)
      setNotice({ tone: 'error', message: 'Clipboard access was blocked. Copy the JSON from the field below.' })
    }
  }

  function openImport() {
    setJsonDraft(JSON.stringify(catalog, null, 2))
    setShowJson(true)
    setNotice(null)
  }

  function importJson() {
    try {
      const parsed: unknown = JSON.parse(jsonDraft)
      if (!validateLearningCatalog(parsed, { answersRequired: true })) throw new Error('JSON does not match the learning catalog schema.')
      setCatalog(parsed)
      const firstPath = parsed.paths[0]
      choosePath(firstPath)
      setDirty(true)
      setShowJson(false)
      setNotice({ tone: 'success', message: 'Catalog imported into the unsaved browser draft.' })
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Could not import JSON.' })
    }
  }

  if (!selectedPath || !selectedUnit || !selectedLesson) {
    return <p className="text-sm text-muted-foreground">The learning catalog has no editable content.</p>
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-7">
      <AdminPageHeader
        eyebrow="Curriculum operations · Versioned publishing"
        title="Learning studio"
        description="Edit a protected database draft, preview the learner journey, and publish an immutable curriculum version."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copyJson}><Clipboard />Copy JSON</Button>
            <Button variant="outline" onClick={openImport}><FileJson />Import</Button>
            <Button variant="outline" onClick={reset} disabled={saving || publishing}><RotateCcw />Defaults</Button>
            <Button variant="outline" onClick={save} disabled={!dirty || saving || publishing}>
              <Save />{saving ? 'Saving…' : dirty ? 'Save draft' : 'Draft saved'}
            </Button>
            <Button onClick={publish} disabled={loading || saving || publishing}>
              <Send />{publishing ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100">
        <p className="font-semibold">Supabase-backed publishing</p>
        <p className="mt-1 leading-6">
          Saving updates the private draft. Publishing creates the learner-facing version; people already enrolled remain on the version they started.
        </p>
        <Label className="mt-3 block">
          <span className="text-xs font-semibold">Change summary</span>
          <Input
            className="mt-1 bg-background/80"
            value={changeSummary}
            onChange={(event) => setChangeSummary(event.target.value)}
            placeholder="What changed in this version?"
          />
        </Label>
      </div>

      {notice && (
        <p className={cn('rounded-xl p-3 text-sm', notice.tone === 'success' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : 'bg-destructive/10 text-destructive')}>
          {notice.message}
        </p>
      )}

      {showJson && (
        <section className="rounded-[2rem] border bg-card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Catalog JSON</h2>
              <p className="text-sm text-muted-foreground">Paste a compatible version 1 catalog or copy the current draft.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowJson(false)}>Close</Button>
              <Button onClick={importJson}>Load into editor</Button>
            </div>
          </div>
          <Textarea className="mt-4 min-h-96 font-mono text-xs leading-5" value={jsonDraft} onChange={(event) => setJsonDraft(event.target.value)} />
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="self-start space-y-4 xl:sticky xl:top-8">
          <div className="rounded-[2rem] border bg-card p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/50 p-3"><p className="font-mono text-xl font-semibold">{totalLessons}</p><p className="text-xs text-muted-foreground">Lessons</p></div>
              <div className="rounded-2xl bg-muted/50 p-3"><p className="font-mono text-xl font-semibold">{totalExercises}</p><p className="text-xs text-muted-foreground">Exercises</p></div>
            </div>
            <p className="mt-5 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Paths</p>
            <div className="mt-2 space-y-2">
              {catalog.paths.map((path) => (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => choosePath(path)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors', selectedPath.id === path.id ? 'border-primary/40 bg-primary/10' : 'hover:bg-muted/50')}
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-muted text-lg">{path.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{path.title}</span><span className="text-xs text-muted-foreground">{getPathLessons(path).length} lessons</span></span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
            <Button className="mt-4 w-full" variant="outline" asChild>
              <Link href="/learn"><Eye />Preview learner view</Link>
            </Button>
          </div>

          <div className="rounded-[2rem] border bg-card p-4">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Units</p>
              <Button size="icon-xs" variant="ghost" onClick={addUnit} aria-label="Add unit"><Plus /></Button>
            </div>
            <div className="mt-2 space-y-1">
              {selectedPath.units.map((unit, index) => (
                <button key={unit.id} type="button" onClick={() => chooseUnit(unit)} className={cn('w-full rounded-xl px-3 py-2 text-left text-sm', selectedUnit.id === unit.id ? 'bg-muted font-semibold' : 'text-muted-foreground hover:bg-muted/50')}>
                  {index + 1}. {unit.title}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Lessons</p>
              <Button size="icon-xs" variant="ghost" onClick={addLesson} aria-label="Add lesson"><Plus /></Button>
            </div>
            <div className="mt-2 space-y-1">
              {selectedUnit.lessons.map((lesson, index) => (
                <button key={lesson.id} type="button" onClick={() => setSelectedLessonId(lesson.id)} className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', selectedLesson.id === lesson.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50')}>
                  <span>{lesson.icon}</span><span className="truncate">{index + 1}. {lesson.title}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          <section className="rounded-[2rem] border bg-card p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10"><Sparkles className="size-5 text-primary" /></span>
              <div><p className="text-sm text-muted-foreground">Path settings</p><h2 className="text-xl font-semibold">{selectedPath.title}</h2></div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Path title"><Input value={selectedPath.title} onChange={(event) => updatePath((path) => ({ ...path, title: event.target.value }))} /></Field>
              <Field label="Short label"><Input value={selectedPath.shortTitle} onChange={(event) => updatePath((path) => ({ ...path, shortTitle: event.target.value }))} /></Field>
              <Field label="Icon"><Input value={selectedPath.icon} onChange={(event) => updatePath((path) => ({ ...path, icon: event.target.value }))} /></Field>
              <Field label="Accent">
                <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedPath.accent} onChange={(event) => updatePath((path) => ({ ...path, accent: event.target.value as LearningPath['accent'] }))}>
                  <option value="violet">Violet</option><option value="amber">Amber</option><option value="emerald">Emerald</option>
                </select>
              </Field>
              <Field label="Description" className="md:col-span-2"><Textarea value={selectedPath.description} onChange={(event) => updatePath((path) => ({ ...path, description: event.target.value }))} /></Field>
              <Field label="Learner outcome" className="md:col-span-2"><Input value={selectedPath.outcome} onChange={(event) => updatePath((path) => ({ ...path, outcome: event.target.value }))} /></Field>
            </div>
          </section>

          <section className="rounded-[2rem] border bg-card p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted"><BookOpen className="size-5" /></span>
              <div className="flex-1"><p className="text-sm text-muted-foreground">Unit</p><h2 className="text-xl font-semibold">{selectedUnit.title}</h2></div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Unit title"><Input value={selectedUnit.title} onChange={(event) => updateUnit((unit) => ({ ...unit, title: event.target.value }))} /></Field>
              <Field label="Unit description"><Input value={selectedUnit.description} onChange={(event) => updateUnit((unit) => ({ ...unit, description: event.target.value }))} /></Field>
            </div>
          </section>

          <section className="rounded-[2rem] border bg-card p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-sm text-muted-foreground">Lesson</p><h2 className="text-2xl font-semibold tracking-tight">{selectedLesson.icon} {selectedLesson.title}</h2><p className="mt-1 font-mono text-xs text-muted-foreground">{selectedLesson.id}</p></div>
              <div className="flex gap-2">
                <Button variant="outline" asChild><Link href={`/learn/${selectedLesson.id}`}><Eye />Preview</Link></Button>
                <Button variant="destructive" size="icon" onClick={removeLesson} aria-label="Delete lesson"><Trash2 /></Button>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Lesson title"><Input value={selectedLesson.title} onChange={(event) => updateLesson((lesson) => ({ ...lesson, title: event.target.value }))} /></Field>
              <Field label="Icon"><Input value={selectedLesson.icon} onChange={(event) => updateLesson((lesson) => ({ ...lesson, icon: event.target.value }))} /></Field>
              <Field label="Description" className="md:col-span-2"><Textarea value={selectedLesson.description} onChange={(event) => updateLesson((lesson) => ({ ...lesson, description: event.target.value }))} /></Field>
              <Field label="Difficulty">
                <select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={selectedLesson.difficulty} onChange={(event) => updateLesson((lesson) => ({ ...lesson, difficulty: event.target.value as PathLesson['difficulty'] }))}>
                  <option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
                </select>
              </Field>
              <Field label="Estimated minutes"><Input type="number" min={1} value={selectedLesson.estimatedMinutes} onChange={(event) => updateLesson((lesson) => ({ ...lesson, estimatedMinutes: Number(event.target.value) }))} /></Field>
              <Field label="Mastery points"><Input type="number" min={0} value={selectedLesson.masteryPoints} onChange={(event) => updateLesson((lesson) => ({ ...lesson, masteryPoints: Number(event.target.value) }))} /></Field>
            </div>
          </section>

          <section className="rounded-[2rem] border bg-card p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-sm text-muted-foreground">Interactive sequence</p><h2 className="text-xl font-semibold">{selectedLesson.exercises.length} exercises</h2></div>
              <div className="flex flex-wrap gap-2">
                {(['concept', 'choice', 'scenario', 'order', 'reflection'] as const).map((type) => (
                  <Button key={type} size="sm" variant="outline" onClick={() => updateLesson((lesson) => ({ ...lesson, exercises: [...lesson.exercises, newExercise(type)] }))}><Plus />{type}</Button>
                ))}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {selectedLesson.exercises.map((exercise, index) => (
                <ExerciseEditor key={exercise.id} exercise={exercise} index={index} onChange={(next) => updateExercise(exercise.id, () => next)} onDelete={() => removeExercise(exercise.id)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <Label className={cn('flex-col items-stretch gap-2', className)}>
      <span>{label}</span>
      {children}
    </Label>
  )
}

function ExerciseEditor({ exercise, index, onChange, onDelete }: { exercise: LearningExercise; index: number; onChange: (exercise: LearningExercise) => void; onDelete: () => void }) {
  return (
    <article className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-background font-mono text-xs ring-1 ring-border">{index + 1}</span>
        <div className="flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{exercise.type}</p><p className="font-mono text-[11px] text-muted-foreground">{exercise.id}</p></div>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete exercise ${index + 1}`}><Trash2 /></Button>
      </div>

      {exercise.type === 'concept' && (
        <div className="grid gap-3">
          <Field label="Title"><Input value={exercise.title} onChange={(event) => onChange({ ...exercise, title: event.target.value })} /></Field>
          <Field label="Explanation"><Textarea className="min-h-28" value={exercise.body} onChange={(event) => onChange({ ...exercise, body: event.target.value })} /></Field>
          <Field label="Key takeaway"><Input value={exercise.takeaway} onChange={(event) => onChange({ ...exercise, takeaway: event.target.value })} /></Field>
        </div>
      )}

      {(exercise.type === 'choice' || exercise.type === 'scenario') && (
        <div className="grid gap-3">
          {exercise.type === 'scenario' && <Field label="Scenario context"><Textarea value={exercise.context} onChange={(event) => onChange({ ...exercise, context: event.target.value })} /></Field>}
          <Field label="Prompt"><Input value={exercise.prompt} onChange={(event) => onChange({ ...exercise, prompt: event.target.value })} /></Field>
          <div className="space-y-2">
            <Label>Answers · select the correct one</Label>
            {exercise.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <button type="button" onClick={() => onChange({ ...exercise, correctIndex: optionIndex })} className={cn('grid size-8 shrink-0 place-items-center rounded-lg border', exercise.correctIndex === optionIndex ? 'border-emerald-500 bg-emerald-500 text-white' : 'bg-background')} aria-label={`Mark answer ${optionIndex + 1} correct`}>
                  {exercise.correctIndex === optionIndex ? <Check className="size-4" /> : optionIndex + 1}
                </button>
                <Input value={option} onChange={(event) => onChange({ ...exercise, options: exercise.options.map((item, index) => index === optionIndex ? event.target.value : item) })} />
                <Button variant="ghost" size="icon-sm" disabled={exercise.options.length <= 2} onClick={() => {
                  const options = exercise.options.filter((_, index) => index !== optionIndex)
                  const currentCorrectIndex = exercise.correctIndex ?? 0
                  const correctIndex =
                    currentCorrectIndex === optionIndex
                      ? 0
                      : currentCorrectIndex > optionIndex
                        ? currentCorrectIndex - 1
                        : currentCorrectIndex
                  onChange({ ...exercise, options, correctIndex })
                }} aria-label={`Delete answer ${optionIndex + 1}`}><Trash2 /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => onChange({ ...exercise, options: [...exercise.options, 'New answer'] })}><Plus />Add answer</Button>
          </div>
          <Field label="Feedback explanation"><Textarea value={exercise.explanation} onChange={(event) => onChange({ ...exercise, explanation: event.target.value })} /></Field>
        </div>
      )}

      {exercise.type === 'order' && (
        <div className="grid gap-3">
          <Field label="Prompt"><Input value={exercise.prompt} onChange={(event) => onChange({ ...exercise, prompt: event.target.value })} /></Field>
          <Field label="Correct order · one item per line">
            <Textarea className="min-h-28" value={exercise.items.join('\n')} onChange={(event) => onChange({ ...exercise, items: event.target.value.split('\n').filter(Boolean) })} />
          </Field>
          <Field label="Feedback explanation"><Textarea value={exercise.explanation} onChange={(event) => onChange({ ...exercise, explanation: event.target.value })} /></Field>
        </div>
      )}

      {exercise.type === 'reflection' && (
        <div className="grid gap-3">
          <Field label="Reflection prompt"><Textarea value={exercise.prompt} onChange={(event) => onChange({ ...exercise, prompt: event.target.value })} /></Field>
          <Field label="Answer placeholder"><Input value={exercise.placeholder} onChange={(event) => onChange({ ...exercise, placeholder: event.target.value })} /></Field>
        </div>
      )}

      {exercise.type === 'tool' && (
        <div className="grid gap-3">
          <Field label="Prompt"><Textarea value={exercise.prompt} onChange={(event) => onChange({ ...exercise, prompt: event.target.value })} /></Field>
          <Field label="Tool">
            {/* A select rather than free text: the id must match a registered
                tool, and the database cannot check that for us. */}
            <select
              value={exercise.toolId}
              onChange={(event) => onChange({ ...exercise, toolId: event.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TOOL_REGISTRY.map((tool) => (
                <option key={tool.id} value={tool.id}>{tool.title}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-muted-foreground">
            The learner must save something in this tool before the lesson can be completed.
          </p>
        </div>
      )}
    </article>
  )
}

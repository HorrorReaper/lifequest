'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  FolderKanban,
  HeartPulse,
  LayoutGrid,
  List,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Plus,
  Search,
  Target,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type {
  ProjectHealth,
  ProjectMilestoneRow,
  ProjectPriority,
  ProjectRow,
  ProjectStatus,
} from '@/lib/supabase/database.types'
import type { Task, TaskStatus } from '@/lib/types'
import { projectProgress } from '@/lib/projects/project-metrics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'
import { cn } from '@/lib/utils'

type ProjectDraft = Pick<
  ProjectRow,
  'name' | 'outcome' | 'description' | 'status' | 'priority' | 'health' | 'start_date' | 'target_date' | 'color'
>

type ProjectView = 'board' | 'list'

const projectStatuses: ProjectStatus[] = ['idea', 'planned', 'active', 'paused', 'completed', 'archived']
const taskColumns: { status: TaskStatus; label: string; description: string }[] = [
  { status: 'backlog', label: 'Backlog', description: 'Captured for later' },
  { status: 'todo', label: 'To do', description: 'Ready to start' },
  { status: 'in_progress', label: 'In progress', description: 'Currently moving' },
  { status: 'blocked', label: 'Blocked', description: 'Needs a decision' },
  { status: 'done', label: 'Done', description: 'Outcome delivered' },
]

function projectToDraft(project: ProjectRow): ProjectDraft {
  return {
    name: project.name,
    outcome: project.outcome,
    description: project.description,
    status: project.status,
    priority: project.priority,
    health: project.health,
    start_date: project.start_date,
    target_date: project.target_date,
    color: project.color,
  }
}

function blankProject(): ProjectDraft {
  return {
    name: '',
    outcome: '',
    description: '',
    status: 'planned',
    priority: 'medium',
    health: 'unset',
    start_date: null,
    target_date: null,
    color: '#7c3aed',
  }
}

export function ProjectsHub({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient() as unknown as SupabaseClient)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [milestones, setMilestones] = useState<ProjectMilestoneRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProjectDraft>(blankProject)
  const [creating, setCreating] = useState(false)
  const [view, setView] = useState<ProjectView>('board')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('todo')
  const [newMilestone, setNewMilestone] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (preferredProjectId?: string) => {
    setLoading(true)
    setError(null)
    const [projectResult, taskResult, milestoneResult] = await Promise.all([
      supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order')
        .order('updated_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .not('project_id', 'is', null)
        .order('sort_order')
        .order('created_at', { ascending: false }),
      supabase
        .from('project_milestones')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order')
        .order('target_date', { ascending: true, nullsFirst: false }),
    ])

    const firstError = projectResult.error ?? taskResult.error ?? milestoneResult.error
    if (firstError) {
      setError(firstError.message)
      setLoading(false)
      return
    }

    const loadedProjects = (projectResult.data ?? []) as ProjectRow[]
    const nextId = preferredProjectId
      ?? (selectedId && loadedProjects.some((project) => project.id === selectedId) ? selectedId : null)
      ?? loadedProjects.find((project) => project.status !== 'archived')?.id
      ?? loadedProjects[0]?.id
      ?? null
    setProjects(loadedProjects)
    setTasks((taskResult.data ?? []) as Task[])
    setMilestones((milestoneResult.data ?? []) as ProjectMilestoneRow[])
    setSelectedId(nextId)
    const nextProject = loadedProjects.find((project) => project.id === nextId)
    setDraft(nextProject ? projectToDraft(nextProject) : blankProject())
    setCreating(false)
    setDirty(false)
    setLoading(false)
  }, [selectedId, supabase, userId])

  useEffect(() => {
    queueMicrotask(() => void load())
    // The initial fetch should not restart when selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId])

  const filteredProjects = useMemo(() => projects.filter((project) => {
    if (statusFilter !== 'all' && project.status !== statusFilter) return false
    if (!deferredQuery) return true
    return `${project.name} ${project.outcome} ${project.description}`
      .toLocaleLowerCase()
      .includes(deferredQuery)
  }), [deferredQuery, projects, statusFilter])

  const selectedProject = projects.find((project) => project.id === selectedId) ?? null
  const projectTasks = tasks.filter((task) => task.project_id === selectedId && task.status !== 'cancelled')
  const projectMilestones = milestones.filter((milestone) => milestone.project_id === selectedId)
  const metrics = projectProgress(projectTasks)
  const completedTasks = metrics.completed
  const progress = metrics.percent

  function updateDraft(patch: Partial<ProjectDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  async function selectProject(project: ProjectRow) {
    if (dirty && selectedProject && !window.confirm('Discard unsaved project changes?')) return
    setSelectedId(project.id)
    setDraft(projectToDraft(project))
    setCreating(false)
    setDirty(false)
  }

  async function createProject() {
    if (!draft.name.trim()) return
    setSaving(true)
    setError(null)
    const { data, error: createError } = await supabase.rpc('create_project_with_home_note', {
      p_name: draft.name.trim(),
      p_outcome: draft.outcome.trim(),
      p_status: draft.status,
      p_priority: draft.priority,
    })
    setSaving(false)
    if (createError) {
      setError(createError.message)
      return
    }
    const createdId = (data as { created_project_id: string }[] | null)?.[0]?.created_project_id
    await load(createdId)
  }

  async function saveProject() {
    if (!selectedProject || !draft.name.trim()) return
    setSaving(true)
    setError(null)
    const completedAt = draft.status === 'completed'
      ? selectedProject.completed_at ?? new Date().toISOString()
      : null
    const { data, error: saveError } = await supabase
      .from('projects')
      .update({
        ...draft,
        name: draft.name.trim(),
        outcome: draft.outcome.trim(),
        description: draft.description.trim(),
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedProject.id)
      .eq('user_id', userId)
      .select('*')
      .single()
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setProjects((current) => current.map((project) => project.id === selectedProject.id ? data as ProjectRow : project))
    setDirty(false)
  }

  async function archiveProject() {
    if (!selectedProject || !window.confirm(`Archive “${selectedProject.name}”? Its tasks and notes remain intact.`)) return
    const { error: archiveError } = await supabase
      .from('projects')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', selectedProject.id)
      .eq('user_id', userId)
    if (archiveError) setError(archiveError.message)
    else await load()
  }

  async function addTask() {
    if (!selectedProject || !newTaskTitle.trim()) return
    const { data, error: taskError } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        project_id: selectedProject.id,
        title: newTaskTitle.trim(),
        priority: 'medium',
        status: newTaskStatus,
        sort_order: projectTasks.filter((task) => task.status === newTaskStatus).length,
      })
      .select('*')
      .single()
    if (taskError) setError(taskError.message)
    else {
      setTasks((current) => [...current, data as Task])
      setNewTaskTitle('')
    }
  }

  async function moveTask(task: Task, status: TaskStatus) {
    const { data, error: taskError } = await supabase
      .from('tasks')
      .update({
        status,
        sort_order: projectTasks.filter((item) => item.status === status).length,
      })
      .eq('id', task.id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (taskError) setError(taskError.message)
    else setTasks((current) => current.map((item) => item.id === task.id ? data as Task : item))
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return
    const { error: taskError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .eq('user_id', userId)
    if (taskError) setError(taskError.message)
    else setTasks((current) => current.filter((item) => item.id !== task.id))
  }

  async function addMilestone() {
    if (!selectedProject || !newMilestone.trim()) return
    const { data, error: milestoneError } = await supabase
      .from('project_milestones')
      .insert({
        user_id: userId,
        project_id: selectedProject.id,
        title: newMilestone.trim(),
        sort_order: projectMilestones.length,
      })
      .select('*')
      .single()
    if (milestoneError) setError(milestoneError.message)
    else {
      setMilestones((current) => [...current, data as ProjectMilestoneRow])
      setNewMilestone('')
    }
  }

  async function toggleMilestone(milestone: ProjectMilestoneRow) {
    const completed = milestone.status !== 'completed'
    const { data, error: milestoneError } = await supabase
      .from('project_milestones')
      .update({
        status: completed ? 'completed' : 'open',
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', milestone.id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (milestoneError) setError(milestoneError.message)
    else setMilestones((current) => current.map((item) => item.id === milestone.id ? data as ProjectMilestoneRow : item))
  }

  function beginCreate() {
    if (dirty && !window.confirm('Discard unsaved project changes?')) return
    setCreating(true)
    setSelectedId(null)
    setDraft(blankProject())
    setDirty(false)
  }

  return (
    <div className="mx-auto max-w-[110rem] space-y-5">
      <AdminPageHeader
        eyebrow="Execution workspace"
        title="Projects"
        description="Connect outcomes, milestones, tasks, and source notes without creating a second task system."
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" /> {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3 xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)]">
          <Button className="w-full" onClick={beginCreate}><Plus /> New project</Button>
          <div className="rounded-[1.5rem] bg-card p-3 ring-1 ring-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" />
            </div>
            <select className="mt-2 h-9 w-full rounded-lg border bg-background px-2 text-sm capitalize" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All statuses</option>
              {projectStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
          <div className="max-h-[calc(100dvh-16rem)] space-y-1 overflow-y-auto rounded-[1.5rem] bg-card p-2 ring-1 ring-border">
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading projects…</p>
            ) : filteredProjects.length === 0 ? (
              <div className="p-6 text-center">
                <FolderKanban className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No projects yet</p>
              </div>
            ) : filteredProjects.map((project) => {
              const projectTaskList = tasks.filter((task) => task.project_id === project.id && task.status !== 'cancelled')
              const projectMetrics = projectProgress(projectTaskList)
              const done = projectMetrics.completed
              const percent = projectMetrics.percent
              return (
                <button
                  type="button"
                  key={project.id}
                  onClick={() => void selectProject(project)}
                  className={cn('w-full rounded-xl p-3 text-left transition-colors', selectedId === project.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted')}
                >
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</p>
                    <span className="text-[10px] capitalize text-muted-foreground">{project.status}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{done}/{projectTaskList.length} tasks · {percent}%</p>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          {(creating || selectedProject) ? (
            <>
              <section className="rounded-[1.75rem] bg-card p-5 ring-1 ring-border sm:p-7">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{creating ? 'New project' : 'Project outcome'}</p>
                    <Input
                      className="mt-2 h-auto border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight focus-visible:ring-0 sm:text-3xl dark:bg-transparent"
                      value={draft.name}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                      placeholder="Project name"
                    />
                    <Textarea
                      className="mt-3 min-h-16 border-0 bg-muted/40 text-base focus-visible:ring-1"
                      value={draft.outcome}
                      onChange={(event) => updateDraft({ outcome: event.target.value })}
                      placeholder="What measurable outcome should this project create?"
                    />
                  </div>
                  {!creating && (
                    <div className="w-32 rounded-2xl bg-muted/50 p-4 text-center">
                      <p className="font-mono text-3xl font-semibold">{progress}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">task progress</p>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <ProjectSelect label="Status" value={draft.status} values={projectStatuses} onChange={(value) => updateDraft({ status: value as ProjectStatus })} />
                  <ProjectSelect label="Priority" value={draft.priority} values={['low', 'medium', 'high', 'urgent']} onChange={(value) => updateDraft({ priority: value as ProjectPriority })} />
                  <ProjectSelect label="Health" value={draft.health} values={['unset', 'on_track', 'at_risk', 'off_track']} onChange={(value) => updateDraft({ health: value as ProjectHealth })} />
                  <ProjectDate label="Start" value={draft.start_date} onChange={(value) => updateDraft({ start_date: value })} />
                  <ProjectDate label="Target" value={draft.target_date} onChange={(value) => updateDraft({ target_date: value })} />
                </div>

                <div className="mt-4">
                  <Label htmlFor="project-description">Context</Label>
                  <Textarea id="project-description" className="mt-2 min-h-24" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="Constraints, decisions, and useful context…" />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {creating ? (
                    <Button onClick={() => void createProject()} disabled={saving || !draft.name.trim()}>
                      {saving ? <LoaderCircle className="animate-spin" /> : <Plus />} Create project and home note
                    </Button>
                  ) : (
                    <>
                      <Button onClick={() => void saveProject()} disabled={saving || !dirty || !draft.name.trim()}>
                        {saving ? <LoaderCircle className="animate-spin" /> : <Check />} Save project
                      </Button>
                      {selectedProject?.home_note_id && (
                        <Button variant="outline" asChild>
                          <Link href={`/admin/notes?note=${selectedProject.home_note_id}`}><FileText /> Open home note</Link>
                        </Button>
                      )}
                      <Button className="ml-auto" variant="ghost" onClick={() => void archiveProject()}><Pause /> Archive</Button>
                    </>
                  )}
                </div>
              </section>

              {!creating && selectedProject && (
                <>
                  <section className="rounded-[1.75rem] bg-card p-4 ring-1 ring-border sm:p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Execution</p>
                        <h2 className="text-xl font-semibold">Project tasks</h2>
                      </div>
                      <div className="ml-auto flex rounded-xl bg-muted p-1">
                        <button type="button" onClick={() => setView('board')} className={cn('flex h-8 items-center gap-1 rounded-lg px-3 text-xs', view === 'board' ? 'bg-background shadow-sm' : 'text-muted-foreground')}><LayoutGrid className="size-3.5" /> Board</button>
                        <button type="button" onClick={() => setView('list')} className={cn('flex h-8 items-center gap-1 rounded-lg px-3 text-xs', view === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground')}><List className="size-3.5" /> List</button>
                      </div>
                    </div>

                    <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto]" onSubmit={(event) => { event.preventDefault(); void addTask() }}>
                      <Input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="Add the next concrete action" />
                      <select className="h-11 rounded-lg border bg-background px-3 text-sm sm:h-9" value={newTaskStatus} onChange={(event) => setNewTaskStatus(event.target.value as TaskStatus)}>
                        {taskColumns.slice(0, 4).map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}
                      </select>
                      <Button type="submit" disabled={!newTaskTitle.trim()}><Plus /> Add</Button>
                    </form>

                    {view === 'board' ? (
                      <div className="mt-5 overflow-x-auto pb-2">
                        <div className="grid min-w-[70rem] grid-cols-5 gap-3">
                          {taskColumns.map((column) => {
                            const columnTasks = projectTasks.filter((task) => task.status === column.status)
                            return (
                              <div key={column.status} className="rounded-2xl bg-muted/35 p-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{column.label}</span>
                                  <span className="ml-auto rounded-full bg-background px-2 py-0.5 font-mono text-xs">{columnTasks.length}</span>
                                </div>
                                <p className="mt-1 text-[10px] text-muted-foreground">{column.description}</p>
                                <div className="mt-3 space-y-2">
                                  {columnTasks.map((task) => (
                                    <TaskCard key={task.id} task={task} onMove={moveTask} onDelete={deleteTask} />
                                  ))}
                                  {columnTasks.length === 0 && <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Empty</div>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 divide-y">
                        {projectTasks.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">No project tasks yet.</p>
                        ) : projectTasks.map((task) => (
                          <div key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                            <button type="button" onClick={() => void moveTask(task, task.status === 'done' ? 'todo' : 'done')} className={cn('grid size-9 place-items-center rounded-xl border', task.status === 'done' && 'bg-primary text-primary-foreground')}>
                              {task.status === 'done' ? <Check className="size-4" /> : <Circle className="size-4" />}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className={cn('truncate text-sm font-medium', task.status === 'done' && 'line-through text-muted-foreground')}>{task.title}</p>
                              <p className="text-xs capitalize text-muted-foreground">{task.status.replace('_', ' ')} · {task.priority}</p>
                            </div>
                            <select className="h-9 rounded-lg border bg-background px-2 text-xs" value={task.status} onChange={(event) => void moveTask(task, event.target.value as TaskStatus)}>
                              {taskColumns.map((column) => <option key={column.status} value={column.status}>{column.label}</option>)}
                            </select>
                            <Button size="icon-sm" variant="ghost" onClick={() => void deleteTask(task)} aria-label={`Delete ${task.title}`}><Trash2 /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <div className="rounded-[1.75rem] bg-card p-5 ring-1 ring-border sm:p-6">
                      <div className="flex items-center gap-2">
                        <Target className="size-5 text-primary" />
                        <h2 className="text-lg font-semibold">Milestones</h2>
                      </div>
                      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void addMilestone() }}>
                        <Input value={newMilestone} onChange={(event) => setNewMilestone(event.target.value)} placeholder="Add a meaningful checkpoint" />
                        <Button type="submit" size="icon" disabled={!newMilestone.trim()} aria-label="Add milestone"><Plus /></Button>
                      </form>
                      <div className="mt-4 space-y-2">
                        {projectMilestones.length === 0 ? (
                          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No milestones yet.</p>
                        ) : projectMilestones.map((milestone) => (
                          <button type="button" key={milestone.id} onClick={() => void toggleMilestone(milestone)} className="flex w-full items-center gap-3 rounded-xl bg-muted/50 p-3 text-left">
                            {milestone.status === 'completed' ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-muted-foreground" />}
                            <span className={cn('min-w-0 flex-1 text-sm', milestone.status === 'completed' && 'line-through text-muted-foreground')}>{milestone.title}</span>
                            {milestone.target_date && <span className="text-xs text-muted-foreground">{milestone.target_date}</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                      <ProjectStat icon={CheckCircle2} label="Completed" value={`${completedTasks}/${projectTasks.length}`} />
                      <ProjectStat icon={HeartPulse} label="Health" value={selectedProject.health.replace('_', ' ')} />
                      <ProjectStat icon={CalendarDays} label="Target" value={selectedProject.target_date ?? 'Open'} />
                    </div>
                  </section>
                </>
              )}
            </>
          ) : (
            <div className="grid min-h-[36rem] place-items-center rounded-[1.75rem] bg-card p-8 text-center ring-1 ring-border">
              <div>
                <FolderKanban className="mx-auto size-10 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Choose or create a project</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">Projects turn your notes and LifeQuest tasks into one outcome-focused execution system.</p>
                <Button className="mt-5" onClick={beginCreate}><Plus /> Create first project</Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ProjectSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm capitalize" value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
      </select>
    </div>
  )
}

function ProjectDate({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string | null) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input className="mt-1" type="date" value={value ?? ''} onChange={(event) => onChange(event.target.value || null)} />
    </div>
  )
}

function TaskCard({ task, onMove, onDelete }: { task: Task; onMove: (task: Task, status: TaskStatus) => Promise<void>; onDelete: (task: Task) => Promise<void> }) {
  const currentIndex = taskColumns.findIndex((column) => column.status === task.status)
  const next = taskColumns[Math.min(taskColumns.length - 1, currentIndex + 1)]?.status
  return (
    <article className="rounded-xl bg-card p-3 shadow-sm ring-1 ring-border">
      <div className="flex items-start gap-2">
        <p className={cn('min-w-0 flex-1 text-sm font-medium leading-snug', task.status === 'done' && 'line-through text-muted-foreground')}>{task.title}</p>
        <Button size="icon-xs" variant="ghost" onClick={() => void onDelete(task)} aria-label={`Delete ${task.title}`}><MoreHorizontal /></Button>
      </div>
      {task.status === 'blocked' && task.blocked_reason && <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{task.blocked_reason}</p>}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] capitalize">{task.priority}</span>
        {task.due_date && <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" />{task.due_date}</span>}
        {task.status !== 'done' && next && next !== task.status && (
          <button type="button" className="ml-auto flex items-center gap-1 text-[10px] font-medium text-primary" onClick={() => void onMove(task, next)}>
            {next.replace('_', ' ')} <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </article>
  )
}

function ProjectStat({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] bg-card p-4 ring-1 ring-border">
      <Icon className="size-4 text-muted-foreground" />
      <p className="mt-3 truncate text-lg font-semibold capitalize">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

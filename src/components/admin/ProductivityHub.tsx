'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ArrowDown, ArrowUp, Check, Clock3, Flame, ListTodo, Pause, Play, Plus, RotateCcw, Target, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FocusSessionRow, ProductivityPriorityRow } from '@/lib/supabase/database.types'
import type { DayPlanBlock, Goal, Task } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AdminPageHeader } from './AdminPageHeader'
import { cn } from '@/lib/utils'

type HabitSummary = { id: string; name: string; emoji: string; done: boolean }
type RoutineSummary = { id: string; name: string; emoji: string }

function secondsLabel(seconds: number) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export function ProductivityHub({ userId, today }: { userId: string; today: string }) {
  const supabase = useMemo(() => createClient() as unknown as SupabaseClient, [])
  const [tasks, setTasks] = useState<Task[]>([])
  const [priorities, setPriorities] = useState<ProductivityPriorityRow[]>([])
  const [activeFocus, setActiveFocus] = useState<FocusSessionRow | null>(null)
  const [habits, setHabits] = useState<HabitSummary[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [routines, setRoutines] = useState<RoutineSummary[]>([])
  const [plan, setPlan] = useState<DayPlanBlock[]>([])
  const [weekMinutes, setWeekMinutes] = useState<{ date: string; minutes: number }[]>([])
  const [newTask, setNewTask] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [duration, setDuration] = useState(25)
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const weekStart = format(addDays(new Date(`${today}T12:00:00`), -6), 'yyyy-MM-dd')
    const [taskRes, priorityRes, focusRes, habitRes, habitLogRes, goalRes, routineRes, planRes, weekRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', userId).eq('is_completed', false).order('priority', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('productivity_daily_priorities').select('*').eq('user_id', userId).eq('priority_date', today).order('sort_order'),
      supabase.from('focus_sessions').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle(),
      supabase.from('habits').select('id,name,emoji').eq('user_id', userId).eq('is_archived', false).order('sort_order'),
      supabase.from('habit_logs').select('habit_id').eq('user_id', userId).eq('log_date', today).eq('completed', true),
      supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').order('sort_order').limit(4),
      supabase.from('routines').select('id,name,emoji').eq('user_id', userId).eq('is_archived', false).order('sort_order').limit(4),
      supabase.from('day_plans').select('blocks').eq('user_id', userId).eq('plan_date', today).maybeSingle(),
      supabase.from('focus_sessions').select('started_at,actual_seconds').eq('user_id', userId).eq('status', 'completed').gte('started_at', `${weekStart}T00:00:00`),
    ])
    const firstError = [taskRes, priorityRes, focusRes, habitRes, habitLogRes, goalRes, routineRes, planRes, weekRes].find((result) => result.error)?.error
    if (firstError) setError(firstError.message)
    const doneIds = new Set((habitLogRes.data ?? []).map((row) => row.habit_id))
    setTasks((taskRes.data ?? []) as Task[])
    setPriorities((priorityRes.data ?? []) as ProductivityPriorityRow[])
    setActiveFocus((focusRes.data as FocusSessionRow | null) ?? null)
    setHabits((habitRes.data ?? []).map((habit) => ({ ...habit, emoji: habit.emoji ?? '✓', done: doneIds.has(habit.id) })))
    setGoals((goalRes.data ?? []) as Goal[])
    setRoutines((routineRes.data ?? []).map((routine) => ({ ...routine, emoji: routine.emoji ?? '↻' })))
    setPlan((((planRes.data as { blocks?: DayPlanBlock[] } | null)?.blocks) ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time)))
    const values = Array.from({ length: 7 }, (_, index) => ({ date: format(addDays(new Date(`${today}T12:00:00`), index - 6), 'yyyy-MM-dd'), minutes: 0 }))
    for (const session of weekRes.data ?? []) { const key = session.started_at.slice(0, 10); const item = values.find((value) => value.date === key); if (item) item.minutes += Math.round((session.actual_seconds ?? 0) / 60) }
    setWeekMinutes(values); setLoading(false)
  }, [supabase, today, userId])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useEffect(() => { if (!activeFocus) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [activeFocus])

  const priorityTasks = priorities.map((priority) => tasks.find((task) => task.id === priority.task_id)).filter(Boolean) as Task[]
  const elapsed = activeFocus ? Math.floor((now - new Date(activeFocus.started_at).getTime()) / 1000) : 0
  const remaining = activeFocus ? activeFocus.planned_minutes * 60 - elapsed : 0
  const focusedToday = weekMinutes.find((item) => item.date === today)?.minutes ?? 0

  async function addTask() { if (!newTask.trim()) return; await supabase.from('tasks').insert({ user_id: userId, title: newTask.trim(), priority: 'medium' }); setNewTask(''); await load() }
  async function saveTask(id: string) { if (!editingTitle.trim()) return; await supabase.from('tasks').update({ title: editingTitle.trim() }).eq('id', id).eq('user_id', userId); setEditingId(null); await load() }
  async function completeTask(id: string) { await supabase.from('tasks').update({ is_completed: true, completed_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId); await load() }
  async function removeTask(id: string) { await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId); await load() }
  async function addPriority(taskId: string) { if (priorities.length >= 3 || priorities.some((item) => item.task_id === taskId)) return; await supabase.from('productivity_daily_priorities').insert({ user_id: userId, priority_date: today, task_id: taskId, sort_order: priorities.length }); await load() }
  async function removePriority(id: string) { await supabase.from('productivity_daily_priorities').delete().eq('id', id); await Promise.all(priorities.filter((p) => p.id !== id).map((p, index) => supabase.from('productivity_daily_priorities').update({ sort_order: index }).eq('id', p.id))); await load() }
  async function movePriority(index: number, direction: -1 | 1) { const next = index + direction; if (next < 0 || next >= priorities.length) return; const current = priorities[index]; const target = priorities[next]; await supabase.from('productivity_daily_priorities').update({ sort_order: 99 }).eq('id', current.id); await supabase.from('productivity_daily_priorities').update({ sort_order: index }).eq('id', target.id); await supabase.from('productivity_daily_priorities').update({ sort_order: next }).eq('id', current.id); await load() }
  async function startFocus(taskId?: string) { const { data, error: startError } = await supabase.from('focus_sessions').insert({ user_id: userId, task_id: taskId ?? null, planned_minutes: duration }).select('*').single(); if (startError) setError(startError.message); else { setActiveFocus(data as FocusSessionRow); setNow(Date.now()) } }
  async function endFocus(status: 'completed' | 'cancelled') { if (!activeFocus) return; const actual = Math.max(0, Math.floor((Date.now() - new Date(activeFocus.started_at).getTime()) / 1000)); await supabase.from('focus_sessions').update({ status, ended_at: new Date().toISOString(), actual_seconds: actual, updated_at: new Date().toISOString() }).eq('id', activeFocus.id); setActiveFocus(null); await load() }

  return <div className="mx-auto max-w-[92rem] space-y-7">
    <AdminPageHeader eyebrow={format(new Date(`${today}T12:00:00`), 'EEEE, d MMMM')} title="Productivity hub" description="Choose the work that matters, protect time for it, and keep the rest of your LifeQuest system in view." />
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
        <div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">The essential three</p><h2 className="text-xl font-semibold tracking-tight">Today’s priorities</h2></div><span className="font-mono text-sm text-muted-foreground">{priorities.length}/3</span></div>
        <div className="mt-5 space-y-2">
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading today...</p> : priorityTasks.length === 0 ? <div className="rounded-2xl bg-muted/50 p-6 text-center"><Target className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium">Pick up to three tasks below</p><p className="mt-1 text-sm text-muted-foreground">A short list creates a sharper day.</p></div> : priorityTasks.map((task, index) => <div key={task.id} className="flex items-center gap-3 rounded-2xl bg-muted/45 p-3"><span className="grid size-8 place-items-center rounded-xl bg-background font-mono text-sm">0{index + 1}</span><p className="min-w-0 flex-1 truncate font-medium">{task.title}</p><Button size="icon" variant="ghost" onClick={() => movePriority(index, -1)} disabled={index === 0} aria-label="Move priority up"><ArrowUp /></Button><Button size="icon" variant="ghost" onClick={() => movePriority(index, 1)} disabled={index === priorities.length - 1} aria-label="Move priority down"><ArrowDown /></Button><Button size="icon" variant="ghost" onClick={() => removePriority(priorities[index].id)} aria-label="Remove priority"><Trash2 /></Button></div>)}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground sm:p-7">
        <Clock3 className="absolute -right-7 -top-7 size-36 opacity-10" />
        <p className="text-sm opacity-70">Focus session</p>
        {activeFocus ? <div className="mt-7"><p className="font-mono text-6xl font-semibold tracking-[-0.08em] tabular-nums">{secondsLabel(remaining)}</p><p className="mt-3 text-sm opacity-75">{tasks.find((task) => task.id === activeFocus.task_id)?.title ?? 'Open focus session'}</p><div className="mt-8 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => endFocus('completed')}><Check /> Complete</Button><Button variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => endFocus('cancelled')}><Pause /> Cancel</Button></div></div> : <div className="mt-6"><div className="flex gap-2">{[25, 50].map((value) => <button key={value} onClick={() => setDuration(value)} className={cn('rounded-xl px-4 py-2 text-sm', duration === value ? 'bg-primary-foreground text-primary' : 'bg-primary-foreground/10')}>{value} min</button>)}<input aria-label="Custom focus minutes" type="number" min="1" max="240" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="w-20 rounded-xl bg-primary-foreground/10 px-3 text-sm outline-none" /></div><Button variant="secondary" className="mt-8 w-full" onClick={() => startFocus(priorityTasks[0]?.id)}><Play /> Start with top priority</Button></div>}
      </div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Working list</p><h2 className="text-xl font-semibold">Open tasks</h2></div><form className="flex min-w-0 flex-1 gap-2 sm:max-w-md" onSubmit={(event) => { event.preventDefault(); void addTask() }}><Input value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Add a task" /><Button type="submit" size="icon" aria-label="Add task"><Plus /></Button></form></div>
        <div className="mt-5 divide-y">
          {tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No open tasks.</p> : tasks.map((task) => <div key={task.id} className="flex items-center gap-2 py-3">{editingId === task.id ? <><Input className="flex-1" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} autoFocus /><Button size="sm" onClick={() => saveTask(task.id)}>Save</Button></> : <><button onClick={() => completeTask(task.id)} className="grid size-10 shrink-0 place-items-center rounded-xl border transition-colors hover:bg-primary hover:text-primary-foreground" aria-label={`Complete ${task.title}`}><Check className="size-4" /></button><button className="min-w-0 flex-1 text-left" onClick={() => { setEditingId(task.id); setEditingTitle(task.title) }}><p className="truncate font-medium">{task.title}</p><p className="text-xs capitalize text-muted-foreground">{task.priority} priority{task.due_date ? ` · ${task.due_date}` : ''}</p></button><Button size="sm" variant="ghost" disabled={priorities.length >= 3 || priorities.some((p) => p.task_id === task.id)} onClick={() => addPriority(task.id)}><Target /> Focus</Button><Button size="icon" variant="ghost" onClick={() => removeTask(task.id)} aria-label="Delete task"><Trash2 /></Button></>}</div>)}
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[2rem] bg-card p-5 ring-1 ring-border"><div className="flex items-center justify-between"><h2 className="font-semibold">Seven-day focus</h2><span className="font-mono text-sm">{weekMinutes.reduce((sum, day) => sum + day.minutes, 0)} min</span></div><div className="mt-5 flex h-24 items-end gap-2">{weekMinutes.map((day) => { const max = Math.max(1, ...weekMinutes.map((item) => item.minutes)); return <div key={day.date} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-primary/75" style={{ height: `${Math.max(4, day.minutes / max * 72)}px` }} /><span className="text-[10px] text-muted-foreground">{format(new Date(`${day.date}T12:00:00`), 'EE')}</span></div> })}</div><p className="mt-3 text-sm text-muted-foreground">{focusedToday} focused minutes today.</p></div>
        <div className="grid grid-cols-2 gap-3"><MiniStat icon={Flame} label="Habits" value={`${habits.filter((h) => h.done).length}/${habits.length}`} /><MiniStat icon={RotateCcw} label="Routines" value={String(routines.length)} /><MiniStat icon={Target} label="Goals" value={String(goals.length)} /><MiniStat icon={ListTodo} label="Plan blocks" value={String(plan.length)} /></div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3"><ContextList title="Today’s plan" empty="No plan blocks yet." items={plan.map((item) => `${item.start_time} · ${item.title}`)} /><ContextList title="Habits" empty="No active habits." items={habits.map((item) => `${item.done ? '✓' : '○'} ${item.emoji} ${item.name}`)} /><ContextList title="Active goals" empty="No active goals." items={goals.map((item) => item.title)} /></section>
  </div>
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Flame; label: string; value: string }) { return <div className="rounded-2xl bg-card p-4 ring-1 ring-border"><Icon className="size-4 text-muted-foreground" /><p className="mt-4 font-mono text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div> }
function ContextList({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div className="rounded-[1.5rem] bg-card p-5 ring-1 ring-border"><h2 className="font-semibold">{title}</h2><div className="mt-4 space-y-2">{items.length ? items.map((item, index) => <p key={`${item}-${index}`} className="rounded-xl bg-muted/45 px-3 py-2 text-sm">{item}</p>) : <p className="text-sm text-muted-foreground">{empty}</p>}</div></div> }

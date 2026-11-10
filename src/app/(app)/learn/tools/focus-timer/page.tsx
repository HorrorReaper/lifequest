import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { FocusSessionRow } from '@/lib/supabase/database.types'
import { FullscreenFocusTimer } from '@/components/admin/FullscreenFocusTimer'
import { FocusTimerTool } from '@/components/tools/focus/FocusTimerTool'
import { dateInTimezone } from '@/lib/dates'
import { pickFocusQuote } from '@/lib/focus-quotes'
import type { TodayPlannerTask } from '@/components/planning/TodayPlanner'

export default async function FocusTimerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: activeSession, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error) return <FocusTimerTool tasks={[]} loadFailed />

  const session = activeSession as FocusSessionRow | null
  if (session) {
    const taskIds = session.committed_task_ids?.length
      ? session.committed_task_ids
      : session.task_id
        ? [session.task_id]
        : []
    const { data } = taskIds.length
      ? await supabase
          .from('tasks')
          .select('id,title')
          .eq('user_id', user.id)
          .in('id', taskIds)
      : { data: [] }
    const titles = new Map(
      (data as { id: string; title: string }[] | null)?.map(({ id, title }) => [
        id,
        title,
      ]),
    )
    const committedTasks = taskIds.flatMap((id) => {
      const title = titles.get(id)
      return title ? [{ id, title }] : []
    })
    return (
      <FullscreenFocusTimer
        key={session.id}
        userId={user.id}
        initial={{
          session,
          now: new Date().getTime(),
          quote: pickFocusQuote(),
          committedTasks,
        }}
        returnHref="/learn/tools"
        refreshOnFinish
      />
    )
  }

  const [tasksResult, { data: profile }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,title,due_date,priority,estimate_minutes')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle(),
  ])
  const timezone = (profile as { timezone: string | null } | null)?.timezone ?? 'UTC'
  const today = dateInTimezone(new Date(), timezone)
  const tasks: TodayPlannerTask[] = (
    (tasksResult.data ?? []) as {
      id: string
      title: string
      due_date: string | null
      priority: TodayPlannerTask['priority'] | null
      estimate_minutes: number | null
    }[]
  ).map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.due_date,
    priority: task.priority ?? 'medium',
    estimateMinutes: task.estimate_minutes,
    isOverdue: task.due_date !== null && task.due_date < today,
  }))
  return (
    <FocusTimerTool tasks={tasks} loadFailed={Boolean(tasksResult.error)} />
  )
}

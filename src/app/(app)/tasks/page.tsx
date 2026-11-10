import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TaskList } from '@/components/tasks/TaskList'
import { PageHeader } from '@/components/ui/page-header'
import { dateInTimezone } from '@/lib/dates'
import { plannedTaskIds } from '@/lib/day-plans'
import type { DayPlanBlock } from '@/lib/types'

export default async function TasksPage({
  searchParams,
}: {
  /** `new=1` opens the task form straight away (the + menu's "Task"). */
  searchParams?: Promise<{ new?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timezone = (profileData as { timezone?: string | null } | null)?.timezone ?? 'UTC'
  const today = dateInTimezone(new Date(), timezone)

  // Only for the "In today's plan" marker; a failed read leaves the marker
  // off rather than the page down.
  const { data: planData } = await supabase
    .from('day_plans')
    .select('blocks')
    .eq('user_id', user.id)
    .eq('plan_date', today)
    .maybeSingle()
  const planned = plannedTaskIds((planData as { blocks?: DayPlanBlock[] } | null)?.blocks)

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Tasks"
          description="Capture what needs doing, give it a date, and check it off."
        />

        <TaskList
          // Remounts when ?new=1 arrives again, so the + menu opens the form
          // even when you are already on this page.
          key={params.new === '1' ? 'new' : 'list'}
          userId={user.id}
          today={today}
          plannedTaskIds={planned}
          initiallyOpen={params.new === '1'}
        />
      </div>
    </main>
  )
}

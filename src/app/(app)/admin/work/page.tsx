import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock3, FolderKanban, NotebookPen } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { TodayPlanSection } from '@/components/dashboard/TodayPlanSection'
import { TaskList } from '@/components/tasks/TaskList'
import { Button } from '@/components/ui/button'
import { fetchDayPlan } from '@/lib/day-plans'
import { getWorkContext } from '@/lib/work/context'

export default async function WorkPage() {
  const { supabase, userId, today, nowMinutes, dateLabel } = await getWorkContext()
  const plan = await fetchDayPlan(supabase, userId, today)

  return (
    <div className="space-y-6">
      <AdminPageHeader eyebrow={dateLabel} title="Work" description="Give your projects a next step and your day a clear direction." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <div className="space-y-5">
          <TodayPlanSection
            key={today}
            blocks={(plan?.blocks ?? []).map((block) => ({ id: block.id, startTime: block.start_time, endTime: block.end_time, title: block.title, category: block.category, missionType: block.mission_type ?? null }))}
            nowMinutes={nowMinutes}
            plannerHref="/admin/work/plan"
          />
          <section className="space-y-3" aria-label="Open tasks">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Next tasks</h2>
              <Button asChild variant="ghost" size="sm"><Link href="/admin/work/tasks">All tasks <ArrowRight /></Link></Button>
            </div>
            <TaskList userId={userId} today={today} compact onlyOpen limit={8} awardCompletionXp={false} />
          </section>
        </div>
        <aside className="space-y-4" aria-label="Work shortcuts">
          <Link href="/admin/work/calendar" className="block rounded-3xl border bg-card p-6 transition-colors hover:bg-muted/50">
            <CalendarDays className="size-5 text-primary" /><h2 className="mt-4 font-semibold">See your calendar</h2>
            <p className="mt-2 text-sm text-muted-foreground">Browse planned time and upcoming task deadlines.</p>
          </Link>
          <Link href="/admin/productivity" className="block rounded-3xl bg-primary p-6 text-primary-foreground transition-opacity hover:opacity-90">
            <Clock3 className="size-6" /><h2 className="mt-5 text-xl font-semibold">Make room for focus</h2>
            <p className="mt-2 text-sm opacity-85">Choose your priorities, start a session and see your focused time.</p>
            <span className="mt-6 flex items-center gap-2 text-sm font-medium">Open focus <ArrowRight className="size-4" /></span>
          </Link>
          <Link href="/admin/work/projects" className="block rounded-3xl border bg-card p-6 transition-colors hover:bg-muted/50">
            <FolderKanban className="size-5 text-primary" /><h2 className="mt-4 font-semibold">Move a project forward</h2>
            <p className="mt-2 text-sm text-muted-foreground">Outcomes, task boards, milestones and project notes.</p>
          </Link>
          <Link href="/admin/notes" className="block rounded-3xl border bg-card p-6 transition-colors hover:bg-muted/50">
            <NotebookPen className="size-5 text-primary" /><h2 className="mt-4 font-semibold">Keep your thinking close</h2>
            <p className="mt-2 text-sm text-muted-foreground">Open Knowledge to capture notes and connect them to your work.</p>
          </Link>
        </aside>
      </div>
    </div>
  )
}

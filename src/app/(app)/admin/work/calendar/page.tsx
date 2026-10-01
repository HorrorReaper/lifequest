import { CalendarOverview } from '@/components/calendar/CalendarOverview'
import { loadCalendarData } from '@/lib/calendar/calendar-data'
import { calendarWindow, type CalendarViewMode } from '@/lib/calendar/calendar-window'
import { parseLocalDate } from '@/lib/dates'
import { getWorkContext } from '@/lib/work/context'

export default async function WorkCalendarPage({ searchParams }: { searchParams: Promise<{ date?: string; view?: string }> }) {
  const { supabase, userId, today } = await getWorkContext()
  const params = await searchParams
  const date = params.date && parseLocalDate(params.date) ? params.date : today
  const view: CalendarViewMode = params.view === 'week' ? 'week' : 'month'
  const { start, end } = calendarWindow(date, view)
  const { plans, tasks } = await loadCalendarData(supabase, userId, start, end)

  return <CalendarOverview
    basePath="/admin/work/calendar"
    plannerPath="/admin/work/plan"
    tasksPath="/admin/work/tasks"
    date={date}
    today={today}
    view={view}
    plans={plans}
    tasks={tasks}
  />
}

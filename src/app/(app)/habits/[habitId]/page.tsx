import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HabitAnalyticsView } from '@/components/habits/HabitAnalyticsView'

interface HabitAnalyticsPageProps {
  params: Promise<{
    habitId: string
  }>
}

interface HabitAnalyticsHabitRow {
  id: string
  name: string
  emoji: string
  is_archived: boolean
  created_at: string
}

interface HabitAnalyticsLogRow {
  log_date: string
  completed: boolean
}

function dateInTimezone(timezone: string, date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default async function HabitAnalyticsPage({
  params,
}: HabitAnalyticsPageProps) {
  const { habitId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: habit, error: habitError },
    { data: logs, error: logsError },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('habits')
      .select('id, name, emoji, is_archived, created_at')
      .eq('id', habitId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('habit_logs')
      .select('log_date, completed')
      .eq('habit_id', habitId)
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('log_date', { ascending: true }),
    supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (habitError) throw habitError
  if (!habit) notFound()
  if (logsError) throw logsError

  const habitRow = habit as unknown as HabitAnalyticsHabitRow
  const logRows = (logs ?? []) as unknown as HabitAnalyticsLogRow[]
  const timezone = (profile as { timezone?: string } | null)?.timezone ?? 'UTC'
  const today = dateInTimezone(timezone, new Date())
  const createdDate = dateInTimezone(timezone, new Date(habitRow.created_at))

  return (
    <HabitAnalyticsView
      habit={{
        id: habitRow.id,
        name: habitRow.name,
        emoji: habitRow.emoji,
        isArchived: habitRow.is_archived,
        createdDate,
      }}
      completionDates={logRows.map((log) => log.log_date)}
      today={today}
    />
  )
}

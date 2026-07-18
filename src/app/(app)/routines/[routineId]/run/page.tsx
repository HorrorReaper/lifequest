import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCompletedHabitIdsForDate, fetchRoutine } from '@/lib/routines'
import { RoutineRunner } from '@/components/routines/RoutineRunner'

interface RoutineRunPageProps {
  params: Promise<{ routineId: string }>
}

function dateInTimezone(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export default async function RoutineRunPage({ params }: RoutineRunPageProps) {
  const { routineId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single()

  const today = dateInTimezone((profile as { timezone: string } | null)?.timezone ?? 'UTC')
  const [routine, completedHabitIds] = await Promise.all([
    fetchRoutine(supabase, user.id, routineId),
    fetchCompletedHabitIdsForDate(supabase, user.id, today),
  ])

  if (!routine || routine.is_archived) redirect('/dashboard')

  return (
    <RoutineRunner
      userId={user.id}
      routine={routine}
      todayDate={today}
      initialCompletedHabitIds={Array.from(completedHabitIds)}
    />
  )
}

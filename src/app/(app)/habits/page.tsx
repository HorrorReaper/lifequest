import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HabitManager } from '@/components/habits/HabitManager'
import { dateInTimezone } from '@/lib/dates'

export default async function HabitsPage({
  searchParams,
}: {
  /** `new=1` opens the create form straight away (the + menu's "Habit"). */
  searchParams?: Promise<{ new?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timezone = (profile as { timezone?: string } | null)?.timezone ?? 'UTC'
  const today = dateInTimezone(new Date(), timezone)

  return (
    <main className="min-h-svh bg-background p-4 pb-24 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <HabitManager
          // Remounts when ?new=1 arrives again, so the + menu opens the form
          // even when you are already on this page.
          key={params.new === '1' ? 'new' : 'list'}
          userId={user.id}
          timezone={timezone}
          today={today}
          initiallyOpen={params.new === '1'}
        />
      </div>
    </main>
  )
}

import { redirect } from 'next/navigation'
import { Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { HabitManager } from '@/components/habits/HabitManager'
import { dateInTimezone } from '@/lib/dates'

export default async function HabitsPage() {
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

        <HabitManager userId={user.id} timezone={timezone} today={today} />
      </div>
    </main>
  )
}

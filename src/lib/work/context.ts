import 'server-only'

import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { showAdminUi } from '@/lib/admin'
import { dateInTimezone } from '@/lib/dates'
import { createClient } from '@/lib/supabase/server'

/** Shared request context, using the same user and day as Tasks and Daily Planner. */
export const getWorkContext = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await showAdminUi(user))) notFound()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw new Error('Your Work settings could not be loaded.')

  const timezone = (profile as { timezone?: string | null } | null)?.timezone ?? 'UTC'
  const now = new Date()
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(clock.find((part) => part.type === 'hour')?.value ?? 0)
  const minute = Number(clock.find((part) => part.type === 'minute')?.value ?? 0)
  return {
    supabase,
    userId: user.id,
    today: dateInTimezone(now, timezone),
    nowMinutes: hour * 60 + minute,
    dateLabel: new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'long', month: 'long', day: 'numeric',
    }).format(now),
  }
})

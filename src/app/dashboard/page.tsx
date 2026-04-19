// src/app/dashboard/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_complete) redirect('/onboarding')

  return (
    <div className="min-h-svh bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {profile.username ?? 'Adventurer'} 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              Level {Math.floor(profile.total_xp / 500) + 1} •{' '}
              {profile.total_xp} XP • 🔥 {profile.current_streak} day streak
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/50 bg-card p-6 text-center text-muted-foreground">
          <p className="text-4xl mb-2">🏕️</p>
          <p>Your city awaits. Start journaling to build it up!</p>
          <p className="text-xs mt-2">
            Dashboard, city view, and insights coming in Weeks 4–6.
          </p>
        </div>
      </div>
    </div>
  )
}


import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getLevel, getCityTier, getXpProgress, CITY_TIER_LABELS } from '@/lib/gamification'
import { getLevelProgress } from '@/lib/city'
import type { Database } from '@/lib/supabase/database.types'
import { TaskList } from '@/components/tasks/TaskList'
import { TodayPlanWidget } from '@/components/dashboard/TodayPlanWidget'
import { DashboardSwitchLink } from '@/components/dashboard/DashboardSwitchLink'

export default async function Dashboard2Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as Database['public']['Tables']['profiles']['Row'] | null

  if (!profile?.onboarding_complete) redirect('/onboarding')

  const level = getLevel(profile.total_xp)
  const cityTier = getCityTier(level)
  const progress = getXpProgress(profile.total_xp)
  const progress2 = getLevelProgress(profile.total_xp)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {profile.username ?? 'Adventurer'} 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {CITY_TIER_LABELS[cityTier]} • Level {level}
            </p>
          </div>
          <DashboardSwitchLink target="/dashboard" label="✨ New dashboard" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">🔥 {profile.current_streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
              {profile.current_streak >= profile.best_streak &&
                profile.current_streak > 0 && (
                  <p className="text-xs text-primary mt-1">Best ever!</p>
                )}
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">⚡ {profile.total_xp}</p>
              <p className="text-xs text-muted-foreground">Total XP</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">🏅 {level}</p>
              <p className="text-xs text-muted-foreground">Level</p>
            </CardContent>
          </Card>
        </div>
        {/*
        <div className="flex items-center justify-between">

  <StreakBadge current={streaks.current} />
  <Link
    href="/analytics"
    className="text-sm text-primary hover:underline"
  >
    View Analytics →
  </Link>
</div>

<div className="grid grid-cols-3 gap-4 mt-4">
  <div className="rounded-lg border p-4 text-center">
    <p className="text-2xl font-bold">{weekly.entryCount}</p>
    <p className="text-xs text-muted-foreground">This week</p>
  </div>
  <div className="rounded-lg border p-4 text-center">
    <p className="text-2xl font-bold">{weekly.daysActive}/7</p>
    <p className="text-xs text-muted-foreground">Days active</p>
  </div>
  <div className="rounded-lg border p-4 text-center">
    <p className="text-2xl font-bold">{weekly.avgMood ?? "—"}</p>
    <p className="text-xs text-muted-foreground">Avg mood</p>
  </div>
</div>*/}

        {/* XP Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Level {level}</span>
            <span>{progress2.next - profile.total_xp} XP to Level {level + 1}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
        <TaskList userId={user.id} compact limit={5} onlyOpen />
        <TodayPlanWidget userId={user.id} />
        {/* Quick Action */}
        <Button asChild size="lg" className="w-full">
          <Link href="/journal">📝 Start Journaling</Link>
        </Button>

      </div>
    </div>
  )
}

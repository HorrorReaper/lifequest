import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { getLevel, getCityTier, getXpProgress, CITY_TIER_LABELS } from '@/lib/gamification'
import { getLockedBuildings } from '@/lib/city'
import type { Database } from '@/lib/supabase/database.types'
import { TaskList } from '@/components/tasks/TaskList'
import { TodayPlanWidget } from '@/components/dashboard/TodayPlanWidget'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { StatTileGrid } from '@/components/dashboard/StatTileGrid'
import { NextRewardCard } from '@/components/dashboard/NextRewardCard'
import { RecentEntriesList } from '@/components/dashboard/RecentEntriesList'
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

  const { data: cityRowData } = await supabase
    .from('city_states')
    .select('coins')
    .eq('user_id', user.id)
    .single()
  const coins = (cityRowData as { coins: number } | null)?.coins ?? 0

  const lockedBuildings = getLockedBuildings(profile.total_xp)
  const nextBuilding = [...lockedBuildings].sort((a, b) => a.xpRequired - b.xpRequired)[0] ?? null

  // Recent entries for quick view
  const { data: recentEntriesData } = await supabase
    .from('journal_entries')
    .select('*, journal_templates(name, icon)')
    .eq('user_id', user.id)
    .eq('is_complete', true)
    .order('entry_date', { ascending: false })
    .limit(3)
  const recentEntries =
    recentEntriesData as
      | (Database['public']['Tables']['journal_entries']['Row'] & {
          journal_templates?: { name: string; icon: string } | null
        })[]
      | null

  const recentEntryItems = (recentEntries ?? []).map((entry) => {
    const tmpl = entry.journal_templates as unknown as { name: string; icon: string } | null
    return {
      id: entry.id,
      templateName: tmpl?.name ?? 'Entry',
      templateIcon: tmpl?.icon ?? '📓',
      entryDate: entry.entry_date,
      xpEarned: entry.xp_earned,
    }
  })

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex justify-end">
          <DashboardSwitchLink target="/dashboard" label="Classic dashboard" />
        </div>

        <DashboardHero
          username={profile.username}
          level={level}
          cityTierLabel={CITY_TIER_LABELS[cityTier]}
          xpNext={progress.next}
          totalXp={profile.total_xp}
          pct={progress.pct}
          coins={coins}
        />

        <StatTileGrid
          streak={profile.current_streak}
          bestStreak={profile.best_streak}
          totalXp={profile.total_xp}
          coins={coins}
          level={level}
        />

        <NextRewardCard building={nextBuilding} currentXp={profile.total_xp} />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Quests
          </h2>
          <TaskList userId={user.id} compact limit={5} onlyOpen />
        </section>

        <TodayPlanWidget userId={user.id} />

        <Button asChild size="lg" className="w-full">
          <Link href="/journal">📝 Start Journaling</Link>
        </Button>

        <RecentEntriesList entries={recentEntryItems} />
      </div>
    </div>
  )
}

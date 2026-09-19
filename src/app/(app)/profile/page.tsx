import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLevel, getCityTier, getXpProgress, CITY_TIER_LABELS } from '@/lib/gamification'
import { fetchSkillXpTotals } from '@/lib/skill-categories'
import { fetchAvatarState } from '@/lib/avatar'
import type { Database } from '@/lib/supabase/database.types'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { SkillLevels } from '@/components/analytics/SkillLevels'
import { AvatarPicker } from '@/components/profile/AvatarPicker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Flame, Trophy, CalendarDays, Settings as SettingsIcon } from 'lucide-react'

export default async function ProfilePage() {
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

  const [{ data: cityRowData }, skillTotals, avatarState] = await Promise.all([
    supabase.from('city_states').select('coins').eq('user_id', user.id).single(),
    fetchSkillXpTotals(supabase, user.id),
    fetchAvatarState(supabase, user.id),
  ])
  const coins = (cityRowData as { coins: number } | null)?.coins ?? 0

  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  })

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile</h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings">
              <SettingsIcon className="size-4" />
              Settings
            </Link>
          </Button>
        </div>

        <DashboardHero
          username={profile.username}
          level={level}
          cityTierLabel={CITY_TIER_LABELS[cityTier]}
          xpNext={progress.next}
          totalXp={profile.total_xp}
          pct={progress.pct}
          coins={coins}
          streak={profile.current_streak}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Flame className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Best streak</p>
                <p className="text-sm font-semibold">
                  {profile.best_streak} {profile.best_streak === 1 ? 'day' : 'days'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Trophy className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">City tier</p>
                <p className="text-sm font-semibold">{CITY_TIER_LABELS[cityTier]}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="flex items-center gap-3 pt-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <CalendarDays className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Member since</p>
                <p className="text-sm font-semibold">{memberSince}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarPicker
              userId={user.id}
              initialAvatarState={avatarState}
              initialCoins={coins}
              currentXp={profile.total_xp}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <SkillLevels totals={skillTotals} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

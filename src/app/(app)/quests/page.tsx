import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fetchQuestPageData } from '@/lib/quests'
import { dateInTimezone } from '@/lib/dates'
import { QuestPageClient } from '@/components/quests/QuestPageClient'

export default async function QuestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timezone = (profileData as { timezone?: string | null } | null)?.timezone ?? 'UTC'
  // Resolved on the server so the cards agree with the challenge RPCs, which
  // derive their day from this same profile timezone.
  const today = dateInTimezone(new Date(), timezone)

  const { annotated, customQuests } = await fetchQuestPageData(supabase, user.id)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Quests</h1>
          <p className="text-sm text-muted-foreground">
            Complete achievements and set your own goals to earn XP &amp; coins.
          </p>
        </div>

        <Link
          href="/challenges"
          className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Flame className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Guided challenges</span>
            <span className="block text-xs text-muted-foreground">Multi-day programs with one action a day.</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>

        <QuestPageClient
          userId={user.id}
          defaultQuests={annotated}
          initialCustomQuests={customQuests}
          today={today}
        />
      </div>
    </div>
  )
}

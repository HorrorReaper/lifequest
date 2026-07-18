import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchQuestPageData } from '@/lib/quests'
import { QuestPageClient } from '@/components/quests/QuestPageClient'

export default async function QuestsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { annotated, customQuests, challengePrograms } = await fetchQuestPageData(supabase, user.id)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Quests</h1>
          <p className="text-sm text-muted-foreground">
            Complete achievements and set your own goals to earn XP &amp; coins.
          </p>
        </div>

        <QuestPageClient
          userId={user.id}
          defaultQuests={annotated}
          initialCustomQuests={customQuests}
          initialChallengePrograms={challengePrograms}
        />
      </div>
    </div>
  )
}

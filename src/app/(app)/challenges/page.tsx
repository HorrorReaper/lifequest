import { redirect } from 'next/navigation'
import { Flame } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { dateInTimezone } from '@/lib/dates'
import { loadChallengesForUser } from '@/lib/challenge-programs'
import { CHALLENGE_FALLBACK_TIMEZONE, getChallengeView, sortChallengePrograms } from '@/lib/challenges'
import { ChallengeCard } from '@/components/challenges/ChallengeCard'
import { CreateChallengeForm } from '@/components/challenges/CreateChallengeForm'

export default async function ChallengesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const timezone = (profileData as { timezone?: string | null } | null)?.timezone ?? CHALLENGE_FALLBACK_TIMEZONE
  const today = dateInTimezone(new Date(), timezone)

  const { programs, sync } = await loadChallengesForUser(supabase, user.id)
  const sorted = sortChallengePrograms(programs)

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Challenges</h1>
          <p className="text-sm text-muted-foreground">
            One concrete action a day: follow a guided program, or set up your own “X days of Y”.
          </p>
        </div>

        <CreateChallengeForm />

        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Flame className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 font-medium">No challenges yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your own above. Guided challenges appear here as soon as they are published.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((program) => {
              const syncRow = sync.find((row) => row.enrollment_id === program.enrollment?.id) ?? null
              return (
                <li key={program.template.id}>
                  <ChallengeCard program={program} view={getChallengeView(program, today, syncRow)} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

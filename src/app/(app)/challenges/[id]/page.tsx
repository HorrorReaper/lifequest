import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays, Coins, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { dateInTimezone } from '@/lib/dates'
import { loadChallengesForUser } from '@/lib/challenge-programs'
import { CHALLENGE_FALLBACK_TIMEZONE, getChallengeView } from '@/lib/challenges'
import { ChallengeDayList } from '@/components/challenges/ChallengeDayList'
import { ChallengeProgressBar } from '@/components/challenges/ChallengeProgressBar'
import { ChallengeTodayPanel } from '@/components/challenges/ChallengeTodayPanel'

interface ChallengeDetailPageProps {
  params: Promise<{ id: string }>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ChallengeDetailPage({ params }: ChallengeDetailPageProps) {
  const { id } = await params
  if (!UUID_PATTERN.test(id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const timezone = (profileData as { timezone?: string | null } | null)?.timezone ?? CHALLENGE_FALLBACK_TIMEZONE
  const today = dateInTimezone(new Date(), timezone)

  const { programs, sync } = await loadChallengesForUser(supabase, user.id, { templateId: id })
  const program = programs[0]
  if (!program) notFound()

  const syncRow = sync.find((row) => row.enrollment_id === program.enrollment?.id) ?? null
  const view = getChallengeView(program, today, syncRow)
  const { template } = program

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/challenges"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All challenges
        </Link>

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {template.duration_days} days · {template.schedule_mode === 'strict' ? 'strict' : 'at your pace'}
            </span>
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Zap className="size-3.5" />
              {template.xp_reward} XP
            </span>
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Coins className="size-3.5" />
              {template.coin_reward}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{template.title}</h1>
          {template.tagline && <p className="text-base font-medium">{template.tagline}</p>}
          {template.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{template.description}</p>
          )}
        </header>

        {view.status !== 'not_started' && <ChallengeProgressBar completed={view.completedDays} total={view.totalDays} />}

        <ChallengeTodayPanel program={program} view={view} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">All days</h2>
          <ChallengeDayList
            program={program}
            currentDayNumber={view.status === 'active' ? view.currentDayNumber : null}
          />
        </section>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, CalendarDays, Coins, Flame, Lock, Sparkles, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { dateInTimezone } from '@/lib/dates'
import { loadChallengesForUser } from '@/lib/challenge-programs'
import { CHALLENGE_FALLBACK_TIMEZONE, getChallengeView, sortChallengePrograms } from '@/lib/challenges'
import { isAutomaticRule } from '@/lib/challenge-rules'
import { ChallengeProgressBar } from '@/components/challenges/ChallengeProgressBar'
import { CreateChallengeForm } from '@/components/challenges/CreateChallengeForm'
import { cn } from '@/lib/utils'

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
              const view = getChallengeView(program, today, syncRow)
              const autoDays = program.days.filter((day) => isAutomaticRule(day.completion_type)).length
              return (
                <li key={program.template.id}>
                  <Link
                    href={`/challenges/${program.template.id}`}
                    className={cn(
                      'block rounded-[1.5rem] border bg-card p-5 transition-colors hover:bg-muted/40',
                      view.status === 'active' && 'border-primary/40'
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={view.status} doneToday={view.doneToday} />
                      {program.template.is_personal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                          <Lock className="size-3" />
                          Personal
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                        <CalendarDays className="size-3" />
                        {program.template.duration_days} days
                      </span>
                      {autoDays > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                          <Sparkles className="size-3" />
                          {autoDays} auto-detected
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight">{program.template.title}</h2>
                        {(program.template.tagline || program.template.description) && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {program.template.tagline || program.template.description}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </div>
                    {view.status === 'active' && view.currentDay && (
                      <p className="mt-3 text-sm">
                        <span className="text-muted-foreground">
                          {view.doneToday ? 'Tomorrow' : `Day ${view.currentDayNumber}`}:
                        </span>{' '}
                        {view.currentDay.title}
                      </p>
                    )}
                    {view.status !== 'not_started' && (
                      <ChallengeProgressBar className="mt-4" completed={view.completedDays} total={view.totalDays} />
                    )}
                    <div className="mt-4 flex gap-3 text-xs">
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <Zap className="size-3.5" />
                        {program.template.xp_reward} XP
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Coins className="size-3.5" />
                        {program.template.coin_reward}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, doneToday }: { status: string; doneToday: boolean }) {
  const label =
    status === 'active'
      ? doneToday
        ? 'Done for today'
        : 'In progress'
      : status === 'completed'
        ? 'Completed'
        : status === 'ended'
          ? 'Stopped'
          : 'New'
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
        status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}

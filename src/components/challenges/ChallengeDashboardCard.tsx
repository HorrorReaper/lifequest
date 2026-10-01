import Link from 'next/link'
import { ChevronRight, Flame } from 'lucide-react'
import type { ChallengeProgram } from '@/lib/challenge-programs'
import type { ChallengeView } from '@/lib/challenges'
import { ChallengeProgressBar } from '@/components/challenges/ChallengeProgressBar'
import { ChallengeTodayPanel } from '@/components/challenges/ChallengeTodayPanel'

/** One active challenge on the dashboard: where you are and today's action. */
export function ChallengeDashboardCard({ program, view }: { program: ChallengeProgram; view: ChallengeView }) {
  return (
    <section className="space-y-3 rounded-xl border p-4" aria-label={`Challenge: ${program.template.title}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Flame className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold sm:text-base">{program.template.title}</h2>
            <p className="text-xs text-muted-foreground">
              Day {Math.min(view.completedDays + 1, view.totalDays)} of {view.totalDays}
            </p>
          </div>
        </div>
        <Link
          href={`/challenges/${program.template.id}`}
          className="flex shrink-0 items-center gap-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          Open <ChevronRight className="size-3" />
        </Link>
      </div>
      <ChallengeProgressBar completed={view.completedDays} total={view.totalDays} />
      <ChallengeTodayPanel program={program} view={view} compact />
    </section>
  )
}

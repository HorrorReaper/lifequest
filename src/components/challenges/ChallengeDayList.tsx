import Link from 'next/link'
import { Check, Lock, Sparkles } from 'lucide-react'
import type { ChallengeProgram } from '@/lib/challenge-programs'
import { isAutomaticRule } from '@/lib/challenge-rules'
import { formatDateOnly } from '@/lib/dates'
import { cn } from '@/lib/utils'

/**
 * Every day of a challenge: done days with their date, the current one
 * highlighted, and upcoming ones by title only. Instructions stay with the
 * day the user is on, so the list reads as a map rather than a to-do list.
 */
export function ChallengeDayList({
  program,
  currentDayNumber,
}: {
  program: ChallengeProgram
  currentDayNumber: number | null
}) {
  const doneByDay = new Map(program.progress.map((item) => [item.day_number, item]))

  return (
    <ol className="space-y-2">
      {program.days.map((day) => {
        const done = doneByDay.get(day.day_number)
        const current = !done && day.day_number === currentDayNumber
        return (
          <li
            key={day.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3',
              current && 'border-primary/40 bg-primary/5',
              !done && !current && 'opacity-70'
            )}
          >
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-lg font-mono text-[11px]',
                done ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
              aria-hidden
            >
              {done ? <Check className="size-4" /> : !current ? <Lock className="size-3.5" /> : day.day_number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                <span className="text-muted-foreground">Day {day.day_number} · </span>
                {day.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {done ? (
                  <span>Done {formatDateOnly(done.completed_on, { day: 'numeric', month: 'short' })}</span>
                ) : current ? (
                  <span>Current day</span>
                ) : (
                  <span>Upcoming</span>
                )}
                {isAutomaticRule(day.completion_type) && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="size-3" /> auto-detected
                  </span>
                )}
              </p>
              {done?.note && <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">“{done.note}”</p>}
              {done?.journal_entry_id && (
                <Link
                  href={`/journal/${done.journal_entry_id}`}
                  className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline"
                >
                  Read your reflection
                </Link>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

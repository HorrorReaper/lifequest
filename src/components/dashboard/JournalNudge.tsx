import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'

interface JournalNudgeProps {
  journals: { id: string; name: string; icon: string; completedToday: boolean }[]
  completedJournalCount: number
}

/**
 * The day's single next move, promoted out of DailyBriefingWidget into a
 * section of its own.
 *
 * It used to be one panel among many inside that widget, which buried the one
 * action the whole product is built around. It is deliberately not duplicated
 * there any more -- two identical journal calls-to-action on one screen would
 * be exactly the kind of competing surface this codebase has grown before.
 *
 * One row, not a card: the suggestion is a single action, and the old card
 * (icon, heading, paragraph, full-height button) took far more room than that
 * deserves. Once today is journaled it shrinks to a small muted link, since
 * the journal tab is always in the nav and nothing is left to push.
 */
export function JournalNudge({ journals, completedJournalCount }: JournalNudgeProps) {
  const nextJournal = journals.find((journal) => !journal.completedToday) ?? journals[0] ?? null
  const journalDone = completedJournalCount > 0

  if (journalDone) {
    return (
      <Link
        href="/journal"
        className="inline-flex items-center gap-1.5 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BookOpen className="size-3.5" aria-hidden="true" />
        Add reflection
      </Link>
    )
  }

  const startable = nextJournal !== null

  return (
    <Link
      href={startable ? `/journal/new/${nextJournal.id}` : '/journal'}
      className="flex h-12 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="shrink-0 text-lg" aria-hidden="true">
        {startable ? nextJournal.icon : '📓'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
          Next best move
        </span>
        <span className="mt-1 block truncate text-sm font-medium leading-none">
          {startable ? `Start ${nextJournal.name}` : 'Open Journal'}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
    </Link>
  )
}

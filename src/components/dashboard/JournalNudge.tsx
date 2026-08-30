import Link from 'next/link'
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
 */
export function JournalNudge({ journals, completedJournalCount }: JournalNudgeProps) {
  const nextJournal = journals.find((journal) => !journal.completedToday) ?? journals[0] ?? null
  const journalDone = completedJournalCount > 0

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Next best move
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {journalDone
              ? 'Today is already on the page. Add another reflection whenever something is worth keeping.'
              : 'Start with a quick journal entry — everything else on this page follows from it.'}
          </p>
        </div>
      </div>

      <Button
        asChild
        size="lg"
        variant={journalDone ? 'secondary' : 'default'}
        className="mt-4 h-auto min-h-14 w-full rounded-xl px-4 py-3.5 text-[0.95rem] sm:min-h-12 sm:py-2.5"
      >
        {!journalDone && nextJournal ? (
          <Link href={`/journal/new/${nextJournal.id}`}>
            <span className="mr-1.5 text-base">{nextJournal.icon}</span>
            Start {nextJournal.name}
            <ArrowRight className="ml-1.5 size-5" />
          </Link>
        ) : (
          <Link href="/journal">
            <BookOpen className="mr-1.5 size-5" />
            {journalDone ? 'Add Reflection' : 'Open Journal'}
          </Link>
        )}
      </Button>
    </section>
  )
}

import Link from 'next/link'
import { PenLine, Sparkles } from 'lucide-react'
import type { ReflectionPrompt } from '@/lib/daily-reflection'
import { DAILY_REFLECTION_TEMPLATE_ID } from '@/lib/daily-reflection'

interface ReflectionSectionProps {
  prompt: ReflectionPrompt
  /** True once a reflection has been written for today. */
  writtenToday: boolean
  /** The id of today's reflection entry, so a second visit edits it. */
  entryId: string | null
}

/**
 * The day's question, and one step from reading it to answering it.
 *
 * Read-only and fed entirely by server props. The answer is written through
 * the normal journal entry form rather than inline here, so a reflection
 * earns XP, counts towards the streak, and can be marked as an insight like
 * every other entry.
 */
export function ReflectionSection({
  prompt,
  writtenToday,
  entryId,
}: ReflectionSectionProps) {
  const href = entryId
    ? `/journal/${entryId}`
    : `/journal/new/${DAILY_REFLECTION_TEMPLATE_ID}?prompt=${prompt.id}`

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">Daily Reflection</h2>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {prompt.theme}
        </span>
      </div>

      <p className="mt-4 text-balance text-base leading-7 sm:text-[0.95rem] sm:leading-6">
        {prompt.text}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-80"
        >
          <PenLine className="size-4" />
          {writtenToday ? 'Read what you wrote' : 'Write about it'}
        </Link>
        {writtenToday && (
          <span className="text-sm text-muted-foreground sm:text-xs">
            Answered today
          </span>
        )}
      </div>
    </section>
  )
}

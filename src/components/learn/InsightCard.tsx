import Link from 'next/link'
import { Star } from 'lucide-react'
import { formatDateOnly } from '@/lib/dates'
import { INSIGHT_TYPE_ICONS, INSIGHT_TYPE_STYLES, insightTypeLabel } from '@/lib/insights'
import type { JournalInsightItem } from '@/lib/journal-insights'
import { cn } from '@/lib/utils'

interface InsightCardProps {
  insight: JournalInsightItem
}

/**
 * One marked insight, at a glance.
 *
 * Read-only on purpose: favouriting, filtering and editing all live on the
 * insights page, and the card links to the reflection it came from.
 */
export function InsightCard({ insight }: InsightCardProps) {
  const Icon = INSIGHT_TYPE_ICONS[insight.type]

  return (
    <Link
      href={`/journal/${insight.entryId}`}
      className="flex h-full flex-col rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            INSIGHT_TYPE_STYLES[insight.type]
          )}
        >
          <Icon className="size-3" />
          {insightTypeLabel(insight.type)}
        </span>
        {insight.isFavorite && (
          <Star className="size-3.5 shrink-0 fill-primary text-primary" aria-label="Favorite" />
        )}
      </div>

      {insight.title && (
        <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug">{insight.title}</p>
      )}
      <p
        className={cn(
          'line-clamp-4 text-xs leading-5 text-muted-foreground',
          insight.title ? 'mt-1.5' : 'mt-3'
        )}
      >
        {insight.answer}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {insight.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {formatDateOnly(insight.entryDate, { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </Link>
  )
}

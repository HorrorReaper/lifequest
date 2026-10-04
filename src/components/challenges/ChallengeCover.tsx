import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'
import {
  CalendarClock,
  Flag,
  Lightbulb,
  ListChecks,
  Mountain,
  NotebookPen,
  Repeat,
  Target,
  Wrench,
} from 'lucide-react'
import { challengeImageSrc } from '@/lib/challenge-images'
import { cn } from '@/lib/utils'

const RULE_ICONS: Record<string, LucideIcon> = {
  manual: Flag,
  reflection: NotebookPen,
  journal_entries: NotebookPen,
  habits_active: Repeat,
  habits_created: Repeat,
  habit_checkins: Repeat,
  day_plans: CalendarClock,
  tasks_created: ListChecks,
  tasks_completed: ListChecks,
  goals_active: Target,
  goals_created: Target,
  learnings_captured: Lightbulb,
  tool_entries: Wrench,
}

/** The placeholder symbol for a day without an image, by how it completes. */
export function challengeDayIcon(completionType: string | null | undefined): LucideIcon {
  return RULE_ICONS[completionType ?? ''] ?? Flag
}

/**
 * A challenge's or a day's cover, like the article covers on /learn: the
 * image when one is set (next/image, allowed hosts only), otherwise a drawn
 * placeholder with a symbol, so a challenge without pictures still looks
 * finished. The parent sets the size; this fills it.
 */
export function ChallengeCover({
  src,
  alt,
  icon: Icon = Mountain,
  label,
  className,
  sizes = '(max-width: 768px) 100vw, 672px',
  priority = false,
}: {
  src: string | null | undefined
  /** Empty for a decorative image next to a visible title. */
  alt: string
  icon?: LucideIcon
  /** Small text on the placeholder, e.g. "Day 3". */
  label?: string
  className?: string
  sizes?: string
  priority?: boolean
}) {
  const image = challengeImageSrc(src)

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {image ? (
        <Image src={image} alt={alt} fill className="object-cover" sizes={sizes} priority={priority} />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/20 via-primary/5 to-muted text-primary/70"
          aria-hidden={alt ? undefined : true}
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
        >
          <Icon className="size-[min(2.5rem,40%)]" strokeWidth={1.5} />
          {label && <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>}
        </div>
      )}
    </div>
  )
}

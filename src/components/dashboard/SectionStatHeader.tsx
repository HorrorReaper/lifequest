import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { SectionHeadingLink } from '@/components/dashboard/ClickableSection'

interface SectionStatHeaderProps {
  icon: LucideIcon
  title: string
  /** The section's page; the title links there (see ClickableSection). */
  href: string
  /** The big number, e.g. 3. Left out, only the title shows. */
  value?: ReactNode
  /** Read after the number in smaller, muted type, e.g. "of 11 today". */
  unit?: ReactNode
  /** The header's control on the right, usually a SectionAddButton. */
  action?: ReactNode
}

/**
 * A dashboard section's header that leads with its figure: the title shrinks
 * to a small label and the day's number is the largest thing in it. Whatever
 * sits under the number (a progress bar, count chips) belongs to the section.
 */
export function SectionStatHeader({
  icon: Icon,
  title,
  href,
  value,
  unit,
  action,
}: SectionStatHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-medium text-muted-foreground sm:text-sm">
          <SectionHeadingLink href={href}>
            <Icon className="mr-1.5 size-4 text-primary" aria-hidden="true" />
            {title}
          </SectionHeadingLink>
        </h2>
        {value !== undefined && (
          <p className="mt-0.5 text-3xl font-semibold leading-tight tabular-nums sm:text-2xl">
            {value}
            {/* A real space, so the line reads as one phrase ("3 of 11 today"). */}
            {unit && ' '}
            {unit && (
              <span className="text-lg font-medium text-muted-foreground sm:text-base">
                {unit}
              </span>
            )}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

import Link from 'next/link'
import { SIGNUP_RANGES, type SignupRange } from '@/lib/signup-analytics'
import { cn } from '@/lib/utils'

export const RANGE_LABELS: Record<SignupRange, string> = {
  30: '30 days',
  90: '90 days',
  365: '1 year',
}

/**
 * The 30 days / 90 days / 1 year switch on the admin Tools page. A link per
 * range rather than client state, so the page's server component reads the
 * range from `?range=` and every card on the page shows the same window.
 */
export function AdminRangeNav({
  range,
  label,
  basePath = '/admin/tools',
}: {
  range: SignupRange
  /** Accessible name of the nav, e.g. "Signup range". */
  label: string
  basePath?: string
}) {
  return (
    <nav aria-label={label} className="flex shrink-0 rounded-full bg-muted p-1 text-xs font-medium">
      {SIGNUP_RANGES.map((days) => {
        const active = days === range
        return (
          <Link
            key={days}
            href={`${basePath}?range=${days}`}
            aria-current={active ? 'page' : undefined}
            scroll={false}
            className={cn(
              'rounded-full px-3 py-1.5 transition-colors',
              active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {RANGE_LABELS[days]}
          </Link>
        )
      })}
    </nav>
  )
}

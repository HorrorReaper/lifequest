import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateOnly } from '@/lib/dates'
import { DIARY_PATH, shiftMonth, type DiaryMonth } from '@/lib/diary'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DiaryMonthCardProps {
  month: DiaryMonth
  /** The current month, which the next-month link stops at. */
  currentMonthKey: string
}

/**
 * A month at a glance on /journal/diary: written days filled, today ringed,
 * days still ahead faded, and "N of M days written". A written day links to
 * its entry.
 */
export function DiaryMonthCard({ month, currentMonthKey }: DiaryMonthCardProps) {
  const canGoNext = month.monthKey < currentMonthKey
  return (
    <section aria-labelledby="diary-month" className="rounded-3xl border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`${DIARY_PATH}?month=${shiftMonth(month.monthKey, -1)}`}
          aria-label="Previous month"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="text-center">
          <h2 id="diary-month" className="text-base font-semibold">
            {month.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{month.written}</span> of {month.elapsed}{' '}
            {month.elapsed === 1 ? 'day' : 'days'} written
          </p>
        </div>
        {canGoNext ? (
          <Link
            href={`${DIARY_PATH}?month=${shiftMonth(month.monthKey, 1)}`}
            aria-label="Next month"
            className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
      </div>

      <div aria-hidden="true" className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day.slice(0, 1)}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: month.leadingBlanks }, (_, index) => (
          <li key={`blank-${index}`} aria-hidden="true" />
        ))}
        {month.days.map((day) => {
          const label = `${formatDateOnly(day.date, { month: 'long', day: 'numeric' })}${
            day.entryId ? ', written' : ''
          }${day.isToday ? ', today' : ''}`
          const className = cn(
            'flex aspect-square max-h-10 w-full items-center justify-center rounded-full text-xs font-semibold',
            day.entryId
              ? 'bg-primary text-primary-foreground'
              : day.isFuture
                ? 'text-muted-foreground/50'
                : 'bg-muted text-muted-foreground',
            day.isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-card'
          )
          return (
            <li key={day.date}>
              {day.entryId ? (
                <Link href={`${DIARY_PATH}/${day.entryId}`} aria-label={label} className={className}>
                  {day.day}
                </Link>
              ) : (
                <span aria-label={label} className={className}>
                  {day.day}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

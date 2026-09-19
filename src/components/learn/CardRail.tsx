'use client'

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** How much of the visible track one arrow click moves. */
const PAGE_FRACTION = 0.8

interface CardRailProps {
  title: string
  /** Shown next to the title; usually how many cards the rail holds. */
  count?: number
  description?: string
  /** Sizing for each card. Every child is wrapped in one snap item. */
  itemClassName?: string
  children: ReactNode
}

/**
 * A horizontally scrolling row of cards.
 *
 * Native scroll-snap rather than a carousel library: it costs no dependency,
 * works with a touch swipe and a trackpad out of the box, and keeps every card
 * a real tab stop. The arrows are the desktop mouse affordance and appear only
 * when there is something to scroll to.
 *
 * Children stay untouched, so a Server Component can pass server-rendered
 * cards through without pulling them into the client bundle.
 */
export function CardRail({
  title,
  count,
  description,
  itemClassName = 'w-[15.5rem] shrink-0 snap-start sm:w-[16.5rem]',
  children,
}: CardRailProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const sync = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const furthest = track.scrollWidth - track.clientWidth
    setOverflowing(furthest > 1)
    setAtStart(track.scrollLeft <= 1)
    setAtEnd(track.scrollLeft >= furthest - 1)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    sync()
    track.addEventListener('scroll', sync, { passive: true })
    // Cards reflow on resize, and images settle in after mount; both change
    // whether there is anything left to scroll to.
    const observer = new ResizeObserver(sync)
    observer.observe(track)
    return () => {
      track.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [sync])

  const page = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth * PAGE_FRACTION, behavior: 'smooth' })
  }

  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {count !== undefined && (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {overflowing && (
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <RailArrow
              label={`Scroll ${title} left`}
              disabled={atStart}
              onClick={() => page(-1)}
            >
              <ChevronLeft className="size-4" />
            </RailArrow>
            <RailArrow
              label={`Scroll ${title} right`}
              disabled={atEnd}
              onClick={() => page(1)}
            >
              <ChevronRight className="size-4" />
            </RailArrow>
          </div>
        )}
      </div>

      <div
        ref={trackRef}
        data-testid="rail-track"
        className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {Children.map(children, (child) => (
          <div className={itemClassName}>{child}</div>
        ))}
      </div>
    </section>
  )
}

function RailArrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-full border bg-background text-muted-foreground transition-colors',
        disabled ? 'opacity-35' : 'hover:border-foreground/30 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

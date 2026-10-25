'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import type { DayPlanMissionType } from '@/lib/types'
import { minutesFromTime, openTasksBehind, splitPlanByTime } from '@/lib/dashboard-plan'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ClickableSection, SectionHeadingLink } from '@/components/dashboard/ClickableSection'
import { SectionAddButton } from '@/components/dashboard/SectionAddButton'

export interface DashboardPlanBlock {
  id: string
  /** "HH:mm" in the user's own timezone. */
  startTime: string
  endTime: string
  title: string
  category: string
  missionType: DayPlanMissionType | null
  /** The task this block was planned from, if any. */
  taskId?: string | null
  /** Whether that task is done. Undefined for a block without a task. */
  taskCompleted?: boolean
}

interface TodayPlanSectionProps {
  blocks: DashboardPlanBlock[]
  /**
   * Minutes past midnight in the user's profile timezone, measured on the
   * server. The section advances it locally rather than re-reading the clock;
   * see the tick effect below.
   */
  nowMinutes: number
  plannerHref?: string
}

/** Blocks shown after the lead one before the day is expanded. */
const COLLAPSED_UPCOMING = 3

/** How often the local clock catches up, in ms. */
const TICK_MS = 30_000

// A block's colour says what kind of work it is. Mission wins over category:
// a main quest should read as a main quest whatever it is scheduled as.
const MISSION_STRIPE: Record<DayPlanMissionType, string> = {
  main_quest: 'bg-primary',
  side_quest: 'bg-purple-500',
  anchor: 'bg-blue-500',
  recovery: 'bg-green-500',
}

const CATEGORY_STRIPE: Record<string, string> = {
  deep_work: 'bg-purple-500',
  meeting: 'bg-blue-500',
  break: 'bg-yellow-500',
  personal: 'bg-green-500',
  exercise: 'bg-red-500',
  other: 'bg-muted-foreground/40',
}

function stripeFor(block: DashboardPlanBlock) {
  if (block.missionType) return MISSION_STRIPE[block.missionType]
  return CATEGORY_STRIPE[block.category] ?? CATEGORY_STRIPE.other
}

/**
 * The shape of today, anchored on the block you are in.
 *
 * The clock decides only where a block sits in time -- behind you, now, or
 * ahead. Whether it is *done* comes from its linked task alone; a block
 * without a task is never called done, and a past block with an open task
 * says "Open". The section used to call every past block done.
 */
export function TodayPlanSection({ blocks, nowMinutes, plannerHref = '/plan' }: TodayPlanSectionProps) {
  const [expanded, setExpanded] = useState(false)

  // Seeded from the server value so the first client render matches the
  // markup React hydrates, then advanced by elapsed time instead of read
  // from the browser clock -- the server measured this in the user's profile
  // timezone, which is not necessarily the timezone of the device.
  const [minutesElapsed, setMinutesElapsed] = useState(0)

  useEffect(() => {
    const mountedAt = Date.now()
    const id = setInterval(() => {
      setMinutesElapsed(Math.floor((Date.now() - mountedAt) / 60_000))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  const now = nowMinutes + minutesElapsed

  const { ordered, past, current, upcoming } = splitPlanByTime(blocks, now)
  const openBehind = openTasksBehind(past)

  const lead = current ?? upcoming[0] ?? null
  const rest = current ? upcoming : upcoming.slice(1)
  const visibleRest = expanded ? rest : rest.slice(0, COLLAPSED_UPCOMING)
  const hiddenCount = past.length + (rest.length - visibleRest.length)
  const remaining = ordered.length - past.length

  return (
    <ClickableSection href={plannerHref} className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarClock className="size-4" />
          </span>
          <h2 className="text-lg font-semibold sm:text-base">
            <SectionHeadingLink href={plannerHref}>Today&apos;s Plan</SectionHeadingLink>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Without a plan the section's own "Plan my day" is the way in.
              With one, "+" goes straight to the timeline: re-answering mood
              and outcomes to add one block is not what it offers. */}
          {ordered.length > 0 && (
            <>
              <span className="text-sm tabular-nums text-muted-foreground">
                {remaining > 0
                  ? `${remaining} ${remaining === 1 ? 'block' : 'blocks'} left`
                  : openBehind.length > 0
                    ? `${openBehind.length} open`
                    : 'No blocks left'}
              </span>
              <SectionAddButton label="Add block" href={`${plannerHref}?step=timeline`} />
            </>
          )}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-base leading-relaxed text-muted-foreground sm:text-sm">
            No plan for today yet. Give the day a shape and the rest gets easier.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={plannerHref}>
              <Plus />
              Plan my day
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {!lead && !expanded && (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              No more time blocks today.
              {openBehind.length > 0
                ? ` ${openBehind.length} planned ${openBehind.length === 1 ? 'task is' : 'tasks are'} still open.`
                : ''}
            </p>
          )}

          <ul className="mt-4 space-y-2">
            {expanded &&
              past.map((block) => (
                <li key={block.id}>
                  <PlanRow block={block} spent />
                </li>
              ))}

            {lead && (
              <li>
                {/* The one row worth reading at a glance, so it gets the height
                    and the colour the compact rows give up. */}
                <div
                  className={cn(
                    'relative overflow-hidden rounded-xl border px-3 py-3',
                    current
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-background'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn('h-10 w-[3px] shrink-0 rounded-full sm:h-9', stripeFor(lead))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">{lead.title}</p>
                      <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                        {lead.startTime} – {lead.endTime}
                        {lead.taskCompleted && ' · task done'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        current
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {current ? 'Now' : 'Next'}
                    </span>
                  </div>

                  {current && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 block h-0.5 bg-primary/60"
                      style={{
                        width: `${Math.round(
                          ((now - minutesFromTime(current.startTime)) /
                            Math.max(
                              minutesFromTime(current.endTime) -
                                minutesFromTime(current.startTime),
                              1
                            )) *
                            100
                        )}%`,
                      }}
                    />
                  )}
                </div>
              </li>
            )}

            {visibleRest.map((block) => (
              <li key={block.id}>
                <PlanRow block={block} />
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={plannerHref}>
                <Pencil />
                Edit plan
              </Link>
            </Button>
          </div>

          {(hiddenCount > 0 || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
            >
              {expanded
                ? 'Show less'
                : past.length > 0
                  ? `Show full day (${past.length} earlier)`
                  : `Show ${hiddenCount} more`}
              <ChevronDown
                className={cn('size-4 transition-transform sm:size-3.5', expanded && 'rotate-180')}
              />
            </button>
          )}
        </>
      )}
    </ClickableSection>
  )
}

function PlanRow({ block, spent = false }: { block: DashboardPlanBlock; spent?: boolean }) {
  // Struck through only when the linked task is really done. A past block
  // without a finished task keeps its title readable and says "Open".
  const done = block.taskCompleted === true
  return (
    <div
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-3 sm:min-h-12',
        spent && !done && block.taskCompleted !== false && 'opacity-60',
        done && 'opacity-70'
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-8 w-[3px] shrink-0 rounded-full sm:h-7', stripeFor(block))}
      />
      {/* Tighter than the lead row's range: on a narrow screen every pixel
          here comes straight out of the block title next to it. */}
      <span className="w-24 shrink-0 whitespace-nowrap font-mono text-sm text-muted-foreground sm:w-[5.25rem] sm:text-xs">
        {block.startTime}–{block.endTime}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-base', done && 'line-through')}>
        {block.title}
      </span>
      {done ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <Check className="size-3.5" aria-hidden="true" />
          Done
        </span>
      ) : (
        spent &&
        block.taskCompleted === false && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-sm font-medium text-amber-800 dark:text-amber-200">
            Open
          </span>
        )
      )}
    </div>
  )
}

import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { ChallengeProgram } from '@/lib/challenge-programs'
import { resolveDayAction, withChallengeReturn } from '@/lib/challenge-rules'
import type { ChallengeView } from '@/lib/challenges'
import { challengeImageSrc } from '@/lib/challenge-images'
import { ChallengeCover, challengeDayIcon } from '@/components/challenges/ChallengeCover'

interface CardContent {
  href: string
  headline: string
  /** A second, smaller line under the headline, when the state needs one. */
  detail?: string
  dayLabel: string
}

/**
 * What the card says and where a tap goes, per challenge state.
 *
 * On a day that is still open the tap goes straight to that day's step -- the
 * same target the detail page's main button uses -- so day 3 of a goals
 * challenge lands on the goals page, not on the challenge. Every other state
 * has nothing to do here and opens the challenge itself, where restarting,
 * ticking off a manual day and the full day list live.
 */
export function challengeCardContent(program: ChallengeProgram, view: ChallengeView): CardContent {
  const { template } = program
  const detailHref = `/challenges/${template.id}`
  const total = view.totalDays
  const day = view.currentDay

  if (view.status === 'completed') {
    return { href: detailHref, headline: 'Challenge complete', dayLabel: `${total} / ${total}` }
  }

  if (view.status !== 'active' || !day) {
    return {
      href: detailHref,
      headline: `${template.duration_days} days, one action a day`,
      dayLabel: `${total} days`,
    }
  }

  if (view.strictMissed) {
    return {
      href: detailHref,
      headline: 'A day was missed',
      detail: 'Open the challenge to restart.',
      dayLabel: `Day ${view.currentDayNumber} / ${total}`,
    }
  }

  if (view.doneToday) {
    return {
      href: detailHref,
      headline: `Day ${view.completedDays} done`,
      detail: `Tomorrow: ${day.title}`,
      dayLabel: `Day ${view.completedDays} / ${total}`,
    }
  }

  const action = resolveDayAction(day)
  return {
    href: action ? withChallengeReturn(action.href, template.id) : detailHref,
    headline: day.title,
    dayLabel: `Day ${day.day_number} / ${total}`,
  }
}

/**
 * The background when neither the day nor the challenge has an image. The
 * theme's primary colour carries white text on its own; Dark's primary is
 * near-white, so it uses its dark secondary instead.
 */
function CardPlaceholder({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70 dark:from-secondary dark:to-secondary/70"
      aria-hidden="true"
    >
      <Icon className="absolute right-4 top-4 size-10 text-white/25" strokeWidth={1.5} />
    </div>
  )
}

/**
 * One active challenge on the dashboard: a picture with the challenge, today's
 * step and the day on top, and one tap into that step.
 *
 * Deliberately small. Instructions, automatic progress, and the manual "done"
 * button stay on /challenges/[id]; the dashboard re-syncs automatic progress
 * on every load, so nothing here needs a "check progress" button.
 */
export function ChallengeDashboardCard({ program, view }: { program: ChallengeProgram; view: ChallengeView }) {
  const { template } = program
  const day = view.currentDay
  const content = challengeCardContent(program, view)
  const image = challengeImageSrc(day?.image_url || template.cover_image_url)

  return (
    <Link
      href={content.href}
      className="group relative block h-36 overflow-hidden rounded-2xl ring-1 ring-foreground/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {image ? (
        <ChallengeCover
          src={image}
          alt=""
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, 672px"
        />
      ) : (
        // Not ChallengeCover's placeholder: its symbol sits dead centre, right
        // where the text goes, and its pale gradient turns grey under the
        // shade.
        <CardPlaceholder icon={challengeDayIcon(day?.completion_type)} />
      )}
      {/* Literal black, not a theme token: the text sits on a photo, whose
          colours no theme controls, so it needs its own dark ground. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/5" aria-hidden="true" />

      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white/80">{template.title}</p>
          <p className="mt-0.5 line-clamp-2 text-base font-semibold leading-snug">{content.headline}</p>
          {content.detail && <p className="mt-0.5 truncate text-xs text-white/80">{content.detail}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold tabular-nums backdrop-blur">
            {content.dayLabel}
          </span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  )
}

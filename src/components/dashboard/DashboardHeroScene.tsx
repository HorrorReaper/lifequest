import type { DayStage } from '@/lib/day-progress'
import { cn } from '@/lib/utils'

interface DashboardHeroSceneProps {
  stage: DayStage
  className?: string
}

/**
 * Elements that join the scene from a stage on fade in rather than pop, and
 * stay still for anyone who asked for less motion.
 */
const FADE = 'transition-opacity duration-700 motion-reduce:transition-none'

const SKY = [
  'fill-[#ece6d8] dark:fill-[#1c2420]',
  'fill-[#e8eedf] dark:fill-[#1e2a25]',
  'fill-[#e2efe0] dark:fill-[#21302a]',
] as const

const GROUND = [
  'fill-[#cdbf9f] dark:fill-[#33402f]',
  'fill-[#b9cf98] dark:fill-[#384d33]',
  'fill-[#9cc37f] dark:fill-[#3d5c37]',
] as const

/** Flowers that appear from stage 1, and the ones that join them at stage 2. */
const FLOWERS_FIRST = [
  { x: 92, y: 124, c: '#e58a8a' },
  { x: 118, y: 130, c: '#f2c96a' },
  { x: 205, y: 120, c: '#c79be0' },
]
const FLOWERS_MORE = [
  { x: 60, y: 132, c: '#f2c96a' },
  { x: 150, y: 126, c: '#e58a8a' },
  { x: 236, y: 128, c: '#f2c96a' },
  { x: 372, y: 116, c: '#e58a8a' },
  { x: 388, y: 122, c: '#c79be0' },
]

/**
 * The landscape behind the dashboard greeting, in three stages.
 *
 * Purely decorative (`aria-hidden`); the greeting says the progress in words.
 * It only ever gains things as the day goes on -- a sun, green, flowers, a
 * tree in leaf, birds -- and never loses any, so a slow day reads as an
 * early morning rather than a failing one. Drawn to be cropped: a phone
 * shows only about x 85-395 of the 480 units and a wide screen loses the
 * top 20, so the sun, the tree and the birds stay inside that frame.
 */
export function DashboardHeroScene({ stage, className }: DashboardHeroSceneProps) {
  const from = (min: DayStage) => (stage >= min ? 'opacity-100' : 'opacity-0')

  return (
    <svg
      aria-hidden="true"
      data-slot="hero-scene"
      data-stage={stage}
      viewBox="0 0 480 140"
      preserveAspectRatio="xMidYMax slice"
      className={cn('h-full w-full', className)}
    >
      <rect width="480" height="140" className={cn(SKY[stage], 'transition-colors duration-700')} />

      <g className={cn(FADE, from(1))}>
        <circle
          cx="300"
          cy="38"
          r={stage >= 2 ? 15 : 11}
          className="fill-[#f2c96a] dark:fill-[#d9cf9f]"
        />
      </g>

      <g className={cn(FADE, from(2))} fill="none" strokeWidth="1.5" strokeLinecap="round">
        <path d="M250 46 q4 -4 8 0 q4 -4 8 0" className="stroke-[#4c4538] dark:stroke-[#c9c2b0]" />
        <path d="M268 58 q4 -4 8 0 q4 -4 8 0" className="stroke-[#4c4538] dark:stroke-[#c9c2b0]" />
      </g>

      <path
        d="M0 98 Q90 78 190 92 T380 86 T480 90 L480 140 L0 140 Z"
        className="fill-[#d9cfb6] dark:fill-[#2a332c]"
      />
      <path
        d="M0 112 Q110 96 230 108 T480 102 L480 140 L0 140 Z"
        className={cn(GROUND[stage], 'transition-colors duration-700')}
      />
      <path
        d="M20 138 Q170 112 300 118 T470 108"
        fill="none"
        strokeWidth="9"
        strokeLinecap="round"
        className="stroke-[#e3d6b4] dark:stroke-[#5a5240]"
      />

      <rect x="342" y="74" width="6" height="40" className="fill-[#7a6a4c] dark:fill-[#6b5d44]" />
      <circle cx="345" cy="72" r="11" className="fill-[#b8b29b] dark:fill-[#4c5446]" />
      <circle
        cx="345"
        cy="66"
        r="18"
        className={cn('fill-[#7fae6a] dark:fill-[#4f7a45]', FADE, from(1))}
      />
      <g className={cn(FADE, from(2))}>
        <circle cx="345" cy="60" r="24" className="fill-[#5f9a54] dark:fill-[#4a7a40]" />
        <circle cx="335" cy="54" r="2.5" fill="#f4d6de" />
        <circle cx="356" cy="62" r="2.5" fill="#f4d6de" />
        <circle cx="344" cy="72" r="2.5" fill="#f4d6de" />
      </g>

      <g className={cn(FADE, from(1))}>
        {FLOWERS_FIRST.map((flower) => (
          <circle key={`${flower.x}-${flower.y}`} cx={flower.x} cy={flower.y} r="3" fill={flower.c} />
        ))}
      </g>
      <g className={cn(FADE, from(2))}>
        {FLOWERS_MORE.map((flower) => (
          <circle key={`${flower.x}-${flower.y}`} cx={flower.x} cy={flower.y} r="3" fill={flower.c} />
        ))}
      </g>
    </svg>
  )
}

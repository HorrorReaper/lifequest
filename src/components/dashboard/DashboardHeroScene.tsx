'use client'

import { useId } from 'react'
import type { DayStage } from '@/lib/day-progress'
import { cn } from '@/lib/utils'

interface DashboardHeroSceneProps {
  stage: DayStage
  className?: string
}

/** The width of one landscape tile, in SVG units; the scroll moves by one. */
const TILE = 480

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
  { x: 40, y: 131, c: '#e58a8a' },
  { x: 205, y: 128, c: '#f2c96a' },
  { x: 330, y: 132, c: '#c79be0' },
]
const FLOWERS_MORE = [
  { x: 90, y: 134, c: '#f2c96a' },
  { x: 160, y: 133, c: '#e58a8a' },
  { x: 265, y: 134, c: '#c79be0' },
  { x: 410, y: 130, c: '#e58a8a' },
  { x: 450, y: 134, c: '#f2c96a' },
]

/** Where the trees stand in a tile: one is in view most of the time. */
const TREES = [130, 390]

/**
 * The landscape behind the dashboard greeting, in three stages.
 *
 * Purely decorative (`aria-hidden`); the greeting says the progress in words.
 * It only ever gains things as the day goes on -- a sun, green, flowers, a
 * tree in leaf, birds -- and never loses any, so a slow day reads as an
 * early morning rather than a failing one.
 *
 * The ground drifts past the walking avatar in two layers, far hills slower
 * than the near ground, path, trees and flowers (`.hero-scroll-far` and
 * `.hero-scroll-near` in globals.css). Each layer draws its tile twice, side
 * by side, and the tile's edges meet at the same height and slope, so the
 * loop never shows a seam. The sky, sun and birds stay put. Drawn to be
 * cropped: a phone shows only about x 85-395 of the 480 units and a wide
 * screen loses the top 20, so the sun and birds stay inside that frame.
 */
export function DashboardHeroScene({ stage, className }: DashboardHeroSceneProps) {
  const from = (min: DayStage) => (stage >= min ? 'opacity-100' : 'opacity-0')
  // Ids for this instance's gradients and masks, safe inside url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const fadeAcross = `${uid}-fade-across`
  const fadeDown = `${uid}-fade-down`
  const maskAcross = `${uid}-mask-across`
  const maskDown = `${uid}-mask-down`

  function tile(offset: number) {
    return (
      <g key={offset} transform={`translate(${offset} 0)`}>
        <path
          d="M0 114 Q120 100 240 114 T480 114 L480 140 L0 140 Z"
          className={cn(GROUND[stage], 'transition-colors duration-700')}
        />
        <path
          d="M0 128 Q120 120 240 128 T480 128"
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-[#e3d6b4] dark:stroke-[#5a5240]"
        />
        {TREES.map((x) => (
          <g key={x}>
            <rect x={x - 3} y="78" width="6" height="40" className="fill-[#7a6a4c] dark:fill-[#6b5d44]" />
            <circle cx={x} cy="76" r="11" className="fill-[#b8b29b] dark:fill-[#4c5446]" />
            <circle
              cx={x}
              cy="70"
              r="18"
              className={cn('fill-[#7fae6a] dark:fill-[#4f7a45]', FADE, from(1))}
            />
            <g className={cn(FADE, from(2))}>
              <circle cx={x} cy="64" r="24" className="fill-[#5f9a54] dark:fill-[#4a7a40]" />
              <circle cx={x - 10} cy="58" r="2.5" fill="#f4d6de" />
              <circle cx={x + 11} cy="66" r="2.5" fill="#f4d6de" />
              <circle cx={x - 1} cy="76" r="2.5" fill="#f4d6de" />
            </g>
          </g>
        ))}
        <g className={cn(FADE, from(1))}>
          {FLOWERS_FIRST.map((flower) => (
            <circle key={flower.x} cx={flower.x} cy={flower.y} r="3" fill={flower.c} />
          ))}
        </g>
        <g className={cn(FADE, from(2))}>
          {FLOWERS_MORE.map((flower) => (
            <circle key={flower.x} cx={flower.x} cy={flower.y} r="3" fill={flower.c} />
          ))}
        </g>
      </g>
    )
  }

  return (
    <svg
      aria-hidden="true"
      data-slot="hero-scene"
      data-stage={stage}
      viewBox={`0 0 ${TILE} 140`}
      preserveAspectRatio="xMidYMax slice"
      className={cn('h-full w-full', className)}
    >
      <defs>
        <linearGradient id={fadeAcross} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="white" stopOpacity="0.9" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={fadeDown} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset="0.7" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={maskAcross} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="110">
          <rect width="320" height="110" fill={`url(#${fadeAcross})`} />
        </mask>
        <mask id={maskDown} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="110">
          <rect width="320" height="110" fill={`url(#${fadeDown})`} />
        </mask>
      </defs>

      <rect width={TILE} height="140" className={cn(SKY[stage], 'transition-colors duration-700')} />

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

      <g className="hero-scroll-far">
        {[0, TILE].map((offset) => (
          <path
            key={offset}
            transform={`translate(${offset} 0)`}
            d="M0 100 Q120 80 240 100 T480 100 L480 140 L0 140 Z"
            className="fill-[#d9cfb6] dark:fill-[#2a332c]"
          />
        ))}
      </g>

      <g className="hero-scroll-near">{[0, TILE].map(tile)}</g>

      {/* A veil of sky behind the greeting, fading out to the right and
          down, so a tree drifting under the words softens instead of
          crossing them. */}
      <g mask={`url(#${maskDown})`}>
        <rect
          width="320"
          height="110"
          mask={`url(#${maskAcross})`}
          className={cn(SKY[stage], 'transition-colors duration-700')}
        />
      </g>
    </svg>
  )
}

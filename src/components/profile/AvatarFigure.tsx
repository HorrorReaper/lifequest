import type { ReactNode } from 'react'
import { AVATAR_SLOTS, type AvatarItem, type AvatarSlot } from '@/lib/avatar'

// The drawn hiker and the gear that goes on it.
//
// Unlike TrailDashboardHero -- which only ever renders while the Trail theme
// is active and so can use literal colors throughout -- this figure appears
// on /profile under every theme. The body is therefore drawn from theme
// tokens (currentColor + var(--muted)) so it adapts, while each item keeps a
// literal color so gear stays recognisable as itself rather than shifting
// hue between themes. Those colors are deliberately mid-lightness (roughly
// 34-62%) so they read against both the cream and the dark surfaces.
//
// All art is authored in one 120x160 coordinate space. PREVIEW_BOXES below
// zooms that same art per slot for the picker's thumbnails, so a thumbnail
// cannot drift from what the figure actually renders.

const PREVIEW_BOXES: Record<AvatarSlot, string> = {
  hat: '30 6 60 44',
  jacket: '32 44 56 64',
  backpack: '32 46 56 58',
  boots: '38 108 44 38',
}

interface ItemArt {
  /** Drawn behind the body -- only packs, which peek out at the sides. */
  behind?: ReactNode
  /** Drawn over the body. */
  front?: ReactNode
}

const ITEM_ART: Record<string, ItemArt> = {
  // --- Hats ---------------------------------------------------------------
  'trail-cap': {
    front: (
      <g fill="hsl(152 32% 38%)" stroke="hsl(152 32% 24%)" strokeWidth="2" strokeLinejoin="round">
        <path d="M 45 33 Q 60 15 75 33 Z" />
        <path d="M 74 33 Q 88 33 90 37 L 74 37 Z" />
      </g>
    ),
  },
  'sun-hat': {
    front: (
      <g fill="hsl(38 52% 62%)" stroke="hsl(30 40% 40%)" strokeWidth="2" strokeLinejoin="round">
        <ellipse cx="60" cy="33" rx="28" ry="6" />
        <path d="M 47 33 Q 60 14 73 33 Z" />
      </g>
    ),
  },
  'winter-hood': {
    front: (
      <g fill="hsl(212 26% 48%)" stroke="hsl(212 30% 30%)" strokeWidth="2" strokeLinejoin="round">
        <path d="M 43 42 Q 41 17 60 17 Q 79 17 77 42 L 70 42 Q 72 26 60 26 Q 48 26 50 42 Z" />
        <circle cx="60" cy="14" r="6" />
      </g>
    ),
  },

  // --- Jackets ------------------------------------------------------------
  'rain-jacket': {
    front: (
      <g fill="hsl(200 45% 48%)" stroke="hsl(202 45% 30%)" strokeWidth="2" strokeLinejoin="round">
        <path d="M 45 58 Q 60 53 75 58 L 73 99 Q 60 103 47 99 Z" />
        <path d="M 49 57 Q 60 66 71 57 Q 60 51 49 57 Z" />
        <path d="M 60 60 L 60 100" stroke="hsl(200 40% 78%)" strokeWidth="1.5" />
      </g>
    ),
  },
  'trail-vest': {
    front: (
      <g fill="hsl(28 48% 50%)" stroke="hsl(26 46% 32%)" strokeWidth="2" strokeLinejoin="round">
        <path d="M 49 58 Q 60 54 71 58 L 70 98 Q 60 101 50 98 Z" />
        <rect x="52" y="76" width="7" height="8" rx="1.5" fill="hsl(26 46% 38%)" />
        <rect x="61" y="76" width="7" height="8" rx="1.5" fill="hsl(26 46% 38%)" />
      </g>
    ),
  },
  'down-jacket': {
    front: (
      <g fill="hsl(348 30% 50%)" stroke="hsl(348 34% 32%)" strokeWidth="2" strokeLinejoin="round">
        <path d="M 44 58 Q 60 52 76 58 L 74 100 Q 60 104 46 100 Z" />
        <g stroke="hsl(348 30% 34%)" strokeWidth="1.5" fill="none">
          <path d="M 45 70 Q 60 73 75 70" />
          <path d="M 45 82 Q 60 85 75 82" />
          <path d="M 46 94 Q 60 97 74 94" />
        </g>
      </g>
    ),
  },

  // --- Backpacks ----------------------------------------------------------
  'day-pack': {
    behind: (
      <rect
        x="43"
        y="60"
        width="34"
        height="30"
        rx="9"
        fill="hsl(88 30% 42%)"
        stroke="hsl(88 34% 26%)"
        strokeWidth="2"
      />
    ),
  },
  'hiking-pack': {
    behind: (
      <g fill="hsl(28 42% 42%)" stroke="hsl(26 44% 26%)" strokeWidth="2" strokeLinejoin="round">
        <rect x="40" y="57" width="40" height="38" rx="10" />
        <rect x="46" y="76" width="28" height="12" rx="4" fill="hsl(28 42% 34%)" />
      </g>
    ),
  },
  'expedition-pack': {
    behind: (
      <g fill="hsl(198 32% 40%)" stroke="hsl(200 36% 24%)" strokeWidth="2" strokeLinejoin="round">
        <rect x="37" y="54" width="46" height="46" rx="11" />
        <ellipse cx="60" cy="55" rx="20" ry="6" fill="hsl(198 32% 32%)" />
        <rect x="45" y="80" width="30" height="13" rx="4" fill="hsl(198 32% 32%)" />
      </g>
    ),
  },

  // --- Boots --------------------------------------------------------------
  'trail-shoes': {
    front: (
      <g fill="hsl(30 20% 45%)" stroke="hsl(30 22% 28%)" strokeWidth="2" strokeLinejoin="round">
        <rect x="45" y="132" width="15" height="9" rx="3" />
        <rect x="61" y="132" width="15" height="9" rx="3" />
      </g>
    ),
  },
  'hiking-boots': {
    front: (
      <g fill="hsl(24 40% 34%)" stroke="hsl(24 44% 20%)" strokeWidth="2" strokeLinejoin="round">
        <rect x="45" y="123" width="15" height="18" rx="3" />
        <rect x="61" y="123" width="15" height="18" rx="3" />
        <g stroke="hsl(38 40% 72%)" strokeWidth="1.5">
          <path d="M 47 129 L 58 129" />
          <path d="M 63 129 L 74 129" />
        </g>
      </g>
    ),
  },
  'expedition-boots': {
    front: (
      <g fill="hsl(215 18% 35%)" stroke="hsl(215 22% 20%)" strokeWidth="2" strokeLinejoin="round">
        <rect x="44" y="113" width="16" height="28" rx="4" />
        <rect x="60" y="113" width="16" height="28" rx="4" />
        <g stroke="hsl(38 40% 72%)" strokeWidth="1.5">
          <path d="M 46 120 L 58 120" />
          <path d="M 46 128 L 58 128" />
          <path d="M 62 120 L 74 120" />
          <path d="M 62 128 L 74 128" />
        </g>
      </g>
    ),
  },
}

/** Shoulder straps, drawn over the body whenever any pack is worn. */
const PACK_STRAPS = (
  <g stroke="hsl(30 25% 30%)" strokeWidth="3" strokeLinecap="round" fill="none">
    <path d="M 52 58 L 50 84" />
    <path d="M 68 58 L 70 84" />
  </g>
)

/** The bare hiker. Shared so a thumbnail's silhouette can never drift from the figure. */
function BaseBody({ showFeet }: { showFeet: boolean }) {
  return (
    <g
      fill="var(--muted)"
      stroke="currentColor"
      strokeOpacity="0.7"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="60" cy="36" r="15" />
      <g strokeWidth="1.8">
        <circle cx="55" cy="33" r="0.6" fill="currentColor" fillOpacity="0.85" />
        <circle cx="65" cy="33" r="0.6" fill="currentColor" fillOpacity="0.85" />
        <path d="M 54.5 40 Q 60 45 65.5 40" fill="none" />
      </g>
      <path d="M 45 58 Q 60 53 75 58 L 73 99 Q 60 103 47 99 Z" />
      <path d="M 46 63 L 35 89" fill="none" />
      <path d="M 74 63 L 85 89" fill="none" />
      <path d="M 54 101 L 52 134" fill="none" />
      <path d="M 66 101 L 68 134" fill="none" />
      {showFeet && (
        <>
          <ellipse cx="50" cy="137" rx="7" ry="4" />
          <ellipse cx="70" cy="137" rx="7" ry="4" />
        </>
      )}
    </g>
  )
}

interface AvatarFigureProps {
  equippedItems: Record<AvatarSlot, string | null>
  className?: string
}

export function AvatarFigure({ equippedItems, className }: AvatarFigureProps) {
  const backpackId = equippedItems.backpack
  const hasBoots = Boolean(equippedItems.boots && ITEM_ART[equippedItems.boots])

  function artFor(slot: AvatarSlot, layer: keyof ItemArt) {
    const itemId = equippedItems[slot]
    if (!itemId) return null
    const node = ITEM_ART[itemId]?.[layer]
    if (!node) return null
    return <g data-avatar-item={itemId}>{node}</g>
  }

  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      role="img"
      aria-label="Your avatar"
      data-testid="avatar-figure"
    >
      {AVATAR_SLOTS.map((slot) => (
        <g key={`behind-${slot}`}>{artFor(slot, 'behind')}</g>
      ))}

      <BaseBody showFeet={!hasBoots} />

      {artFor('jacket', 'front')}
      {backpackId && ITEM_ART[backpackId]?.behind && PACK_STRAPS}
      {artFor('boots', 'front')}
      {artFor('hat', 'front')}
    </svg>
  )
}

/** The head region of the shared coordinate space -- face plus whatever hat is worn. */
const HEAD_BOX = '32 8 56 46'

interface AvatarHeadProps {
  equippedItems: Record<AvatarSlot, string | null>
  className?: string
  /** Set when nesting inside another SVG, which also clips the body below the neck. */
  x?: number
  y?: number
  width?: number
  height?: number
}

/**
 * Just the avatar's head, reusing the figure's own art rather than a second
 * drawing of it. Small enough to sit inside another illustration -- the
 * dashboard's trail marker nests one via x/y/width/height.
 */
export function AvatarHead({ equippedItems, className, x, y, width, height }: AvatarHeadProps) {
  const hatId = equippedItems.hat
  const hatArt = hatId ? ITEM_ART[hatId]?.front : null

  return (
    <svg
      viewBox={HEAD_BOX}
      className={className}
      x={x}
      y={y}
      width={width}
      height={height}
      role="img"
      aria-label="Your avatar"
      data-testid="avatar-head"
    >
      <BaseBody showFeet={false} />
      {hatArt && <g data-avatar-item={hatId}>{hatArt}</g>}
    </svg>
  )
}

/**
 * One item on its own, zoomed to its slot's region of the shared coordinate
 * space, over a faded silhouette of the body.
 *
 * The silhouette is not decoration: isolated gear is genuinely hard to read
 * -- a jacket alone is an anonymous cylinder and a hood is an arch -- and the
 * ghost restores the context that makes each shape identifiable at thumbnail
 * size.
 *
 * Falls back to the catalog emoji for an item that has no art yet, so adding
 * a catalog entry can never render an empty thumbnail.
 */
export function AvatarItemArt({ item, className }: { item: AvatarItem; className?: string }) {
  const art = ITEM_ART[item.id]

  if (!art) {
    return (
      <span className={className} aria-hidden="true">
        {item.emoji}
      </span>
    )
  }

  return (
    <svg
      viewBox={PREVIEW_BOXES[item.slot]}
      className={className}
      aria-hidden="true"
      data-avatar-item-preview={item.id}
    >
      {art.behind}
      <g opacity="0.25">
        <BaseBody showFeet={item.slot !== 'boots'} />
      </g>
      {art.front}
    </svg>
  )
}

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

type Side = 'left' | 'right'
const SIDES: readonly Side[] = ['left', 'right']

interface ItemArt {
  /** Drawn behind the body -- only packs, which peek out at the sides. */
  behind?: ReactNode
  /** Drawn over the body. */
  front?: ReactNode
  /**
   * Drawn over each leg, inside that leg's group, so it moves with the leg
   * when the figure walks -- only boots.
   */
  legs?: Record<Side, ReactNode>
}

/** One boot per leg, both in the same colors. */
function bootPair(
  colors: { fill: string; stroke: string },
  left: ReactNode,
  right: ReactNode
): Record<Side, ReactNode> {
  const wrap = (node: ReactNode) => (
    <g fill={colors.fill} stroke={colors.stroke} strokeWidth="2" strokeLinejoin="round">
      {node}
    </g>
  )
  return { left: wrap(left), right: wrap(right) }
}

/** The laces drawn across a boot, one line per y. */
function laces(x1: number, x2: number, ys: number[]) {
  return (
    <g stroke="hsl(38 40% 72%)" strokeWidth="1.5">
      {ys.map((y) => (
        <path key={y} d={`M ${x1} ${y} L ${x2} ${y}`} />
      ))}
    </g>
  )
}

const ITEM_ART: Record<string, ItemArt> = {
  // --- Hats ---------------------------------------------------------------
  // Both hats band at y=28, not y=33: the eyes sit at y=33, so a brim there
  // cut straight across the face. The head's half-width at y=28 is ~12.7, so
  // a crown spanning x=47..73 meets the skull instead of overhanging it, and
  // a control point at y=14 peaks the crown at y=21 -- exactly the top of the
  // head circle.
  'trail-cap': {
    front: (
      <g fill="hsl(152 32% 38%)" stroke="hsl(152 32% 24%)" strokeWidth="2" strokeLinejoin="round">
        <path d="M 47 28 Q 60 14 73 28 Z" />
        {/* Brim reaches x=86, so ~13 units clear the skull -- shorter than the
            head's 15-unit radius. Running it out to 90 read as a plank.
            Shifted 2 units above the crown's own y=28 base so its tip lands
            on that same line instead of hanging below it -- the crown's arc
            at x=68 (where the brim starts) is already up at y~23.7, so the
            brim sitting any higher than its old y=28 start reads as tucked
            under the crown rather than floating apart from it. */}
        <path d="M 68 26 Q 80 25 86 28 Q 79 30 68 29 Z" />
      </g>
    ),
  },
  'sun-hat': {
    front: (
      <g fill="hsl(38 52% 62%)" stroke="hsl(30 40% 40%)" strokeWidth="2" strokeLinejoin="round">
        <ellipse cx="60" cy="29" rx="28" ry="5.5" />
        <path d="M 48 29 Q 60 13 72 29 Z" />
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
    legs: bootPair(
      { fill: 'hsl(30 20% 45%)', stroke: 'hsl(30 22% 28%)' },
      <rect x="45" y="132" width="15" height="9" rx="3" />,
      <rect x="61" y="132" width="15" height="9" rx="3" />
    ),
  },
  'hiking-boots': {
    legs: bootPair(
      { fill: 'hsl(24 40% 34%)', stroke: 'hsl(24 44% 20%)' },
      <>
        <rect x="45" y="123" width="15" height="18" rx="3" />
        {laces(47, 58, [129])}
      </>,
      <>
        <rect x="61" y="123" width="15" height="18" rx="3" />
        {laces(63, 74, [129])}
      </>
    ),
  },
  'expedition-boots': {
    legs: bootPair(
      { fill: 'hsl(215 18% 35%)', stroke: 'hsl(215 22% 20%)' },
      <>
        <rect x="44" y="113" width="16" height="28" rx="4" />
        {laces(46, 58, [120, 128])}
      </>,
      <>
        <rect x="60" y="113" width="16" height="28" rx="4" />
        {laces(62, 74, [120, 128])}
      </>
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

/** The bare body's look: drawn from theme tokens so it fits every theme. */
function BodyStyle({ children }: { children: ReactNode }) {
  return (
    <g
      fill="var(--muted)"
      stroke="currentColor"
      strokeOpacity="0.7"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  )
}

/**
 * Hips from y=100 to the soles at y=141, which is the length that sets how
 * far a foot travels per step when the figure walks (see the hero's stride in
 * src/components/dashboard/DashboardGreeting.tsx).
 */
export const AVATAR_LEG_UNITS = 41

/**
 * Each limb and the point it turns around when the figure walks: the
 * shoulders and the hips. The legs start at y=94, inside the torso and drawn
 * behind it, so a swinging or lifted leg never shows its top end.
 */
const LIMBS: Record<
  Side,
  { arm: string; shoulder: string; leg: string; hip: string; footX: number }
> = {
  left: { arm: 'M 46 63 L 35 89', shoulder: '46px 63px', leg: 'M 54.4 94 L 52 134', hip: '54px 100px', footX: 50 },
  right: { arm: 'M 74 63 L 85 89', shoulder: '74px 63px', leg: 'M 65.6 94 L 68 134', hip: '66px 100px', footX: 70 },
}

function Head() {
  return (
    <>
      <circle cx="60" cy="36" r="15" />
      <g strokeWidth="1.8">
        <circle cx="55" cy="33" r="0.6" fill="currentColor" fillOpacity="0.85" />
        <circle cx="65" cy="33" r="0.6" fill="currentColor" fillOpacity="0.85" />
        <path d="M 54.5 40 Q 60 45 65.5 40" fill="none" />
      </g>
    </>
  )
}

const TORSO = <path d="M 45 58 Q 60 53 75 58 L 73 99 Q 60 103 47 99 Z" />

// The `data-avatar-part` groups are what the dashboard hero animates (see
// `.hero-stride` in src/app/globals.css); everywhere else they stand still.

function Arm({ side }: { side: Side }) {
  return (
    <g data-avatar-part="arm" data-side={side} style={{ transformOrigin: LIMBS[side].shoulder }}>
      <BodyStyle>
        <path d={LIMBS[side].arm} fill="none" />
      </BodyStyle>
    </g>
  )
}

function Leg({ side, showFoot, children }: { side: Side; showFoot: boolean; children?: ReactNode }) {
  return (
    <g data-avatar-part="leg" data-side={side} style={{ transformOrigin: LIMBS[side].hip }}>
      <BodyStyle>
        <path d={LIMBS[side].leg} fill="none" />
        {showFoot && <ellipse cx={LIMBS[side].footX} cy="137" rx="7" ry="4" />}
      </BodyStyle>
      {children}
    </g>
  )
}

/**
 * The bare hiker, standing. Shared so a thumbnail's silhouette can never
 * drift from the figure.
 *
 * `headOnly` genuinely omits the body rather than relying on a tighter
 * viewBox to hide it: an SVG's viewport does not reliably clip what falls
 * outside it here, which left the torso's top curve floating under an
 * otherwise bodiless head.
 */
function BaseBody({ showFeet, headOnly = false }: { showFeet: boolean; headOnly?: boolean }) {
  if (headOnly) {
    return (
      <BodyStyle>
        <Head />
      </BodyStyle>
    )
  }
  return (
    <>
      {SIDES.map((side) => (
        <Leg key={side} side={side} showFoot={showFeet} />
      ))}
      <BodyStyle>
        {TORSO}
        <Head />
      </BodyStyle>
      {SIDES.map((side) => (
        <Arm key={side} side={side} />
      ))}
    </>
  )
}

interface AvatarFigureProps {
  equippedItems: Record<AvatarSlot, string | null>
  className?: string
}

export function AvatarFigure({ equippedItems, className }: AvatarFigureProps) {
  const backpackId = equippedItems.backpack
  const hasBoots = Boolean(equippedItems.boots && ITEM_ART[equippedItems.boots])

  function artFor(slot: AvatarSlot, layer: 'behind' | 'front') {
    return wrapItem(slot, ITEM_ART[equippedItems[slot] ?? '']?.[layer])
  }

  function bootFor(side: Side) {
    return wrapItem('boots', ITEM_ART[equippedItems.boots ?? '']?.legs?.[side])
  }

  function wrapItem(slot: AvatarSlot, node: ReactNode) {
    const itemId = equippedItems[slot]
    if (!itemId || !node) return null
    return <g data-avatar-item={itemId}>{node}</g>
  }

  // Drawn in layers so the figure can walk: the legs (boots on them) sit
  // behind the torso, and everything above the hips -- packs, torso, head,
  // arms and gear -- is one `body` group that can bob as a whole. Standing
  // still, it looks the same as one flat drawing.
  return (
    <svg
      viewBox="0 0 120 160"
      className={className}
      role="img"
      aria-label="Your avatar"
      data-testid="avatar-figure"
    >
      <g data-avatar-part="body">
        {AVATAR_SLOTS.map((slot) => (
          <g key={`behind-${slot}`}>{artFor(slot, 'behind')}</g>
        ))}
      </g>

      {SIDES.map((side) => (
        <Leg key={side} side={side} showFoot={!hasBoots}>
          {bootFor(side)}
        </Leg>
      ))}

      <g data-avatar-part="body">
        <BodyStyle>
          {TORSO}
          <Head />
        </BodyStyle>
        {SIDES.map((side) => (
          <Arm key={side} side={side} />
        ))}
        {artFor('jacket', 'front')}
        {backpackId && ITEM_ART[backpackId]?.behind && PACK_STRAPS}
        {artFor('hat', 'front')}
      </g>
    </svg>
  )
}

/**
 * The head region of the shared coordinate space -- face plus whatever hat is
 * worn. Ends at y=52.5: the head's own stroke reaches 52.25, while the torso
 * path's top curve peaks at 53, so this keeps the whole head and excludes the
 * body. Cropping mid-curve instead left a stray line under a headshot that has
 * no body attached to explain it.
 */
const HEAD_BOX = '32 6 56 46.5'

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
      <BaseBody showFeet={false} headOnly />
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
      {art.legs?.left}
      {art.legs?.right}
    </svg>
  )
}

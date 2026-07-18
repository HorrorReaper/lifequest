import type { BuildingType } from '@/lib/city/city'
import { cn } from '@/lib/utils'

interface BuildingSpriteProps {
  building: BuildingType
  className?: string
  muted?: boolean
}

const PALETTES = {
  residential: { body: '#F4B36A', side: '#C97842', roof: '#8F493A', accent: '#FFF0C9' },
  commercial: { body: '#5FA9A0', side: '#377A74', roof: '#285F5C', accent: '#F8D57A' },
  civic: { body: '#8BA6C9', side: '#586F96', roof: '#405579', accent: '#F4E8C7' },
  nature: { body: '#6FA96D', side: '#3F784F', roof: '#285E3D', accent: '#F1C96A' },
  landmark: { body: '#D29A62', side: '#93633F', roof: '#5D4B42', accent: '#F6D98A' },
} as const

const TALL_BUILDINGS = new Set([
  'apartment',
  'hotel',
  'skyscraper',
  'innovation-district',
  'orbital-elevator',
  'quantum-archive',
  'sky-citadel',
])

const DOME_BUILDINGS = new Set([
  'fountain',
  'stadium',
  'botanical-dome',
  'grand-observatory',
  'spaceport',
])

function GroundTile() {
  return (
    <>
      <path d="M48 72 82 54 48 36 14 54Z" fill="#9BC58B" />
      <path d="M14 54v7l34 18v-7Z" fill="#6E9D66" />
      <path d="M82 54v7L48 79v-7Z" fill="#568454" />
      <ellipse cx="49" cy="58" rx="24" ry="10" fill="#294B3B" opacity=".16" />
    </>
  )
}

function NatureSprite({ id, accent }: { id: string; accent: string }) {
  if (id === 'flower') {
    return (
      <>
        <path d="M31 58c8-7 26-7 34 0l-3 9c-9 5-20 5-28 0Z" fill="#557D4D" />
        {[[38, 55], [48, 51], [57, 57], [47, 62]].map(([cx, cy], index) => (
          <g key={index}>
            <circle cx={cx} cy={cy} r="4" fill={index % 2 ? '#F3A6A0' : accent} />
            <circle cx={cx} cy={cy} r="1.5" fill="#FFF6D7" />
          </g>
        ))}
      </>
    )
  }

  if (id === 'bench') {
    return (
      <>
        <path d="m32 50 30 3v7l-30-3Z" fill="#A66A43" />
        <path d="m32 59 30 3v6l-30-3Z" fill="#825037" />
        <path d="M35 65v8M59 66v7" stroke="#4E493F" strokeWidth="4" />
      </>
    )
  }

  if (id === 'fountain') {
    return (
      <>
        <ellipse cx="48" cy="61" rx="20" ry="10" fill="#4F8D92" />
        <ellipse cx="48" cy="58" rx="16" ry="7" fill="#A7DBD8" />
        <path d="M48 58V41M39 54c0-8 4-12 9-13M57 54c0-8-4-12-9-13" stroke="#DDF5EF" strokeWidth="3" strokeLinecap="round" />
        <circle cx="48" cy="40" r="4" fill={accent} />
      </>
    )
  }

  if (id === 'botanical-dome' || id === 'park') {
    return (
      <>
        <path d="M27 63c1-20 11-30 21-30s20 10 21 30Z" fill="#82C8B5" opacity=".88" />
        <path d="M48 34v29M32 57h32M36 42l24 18M60 42 36 60" stroke="#E6F4D8" strokeWidth="2" opacity=".85" />
        <path d="M36 62c2-12 7-17 12-17s10 5 12 17Z" fill="#3F7F52" />
      </>
    )
  }

  return (
    <>
      <path d="M45 50h7v21h-7Z" fill="#76513B" />
      <circle cx="48" cy="39" r="16" fill="#4B8B5A" />
      <circle cx="38" cy="44" r="10" fill="#69A967" />
      <circle cx="57" cy="46" r="11" fill="#3F7850" />
      <circle cx="49" cy="31" r="10" fill="#78B86F" />
    </>
  )
}

function DomeSprite({ palette, id }: { palette: (typeof PALETTES)[keyof typeof PALETTES]; id: string }) {
  return (
    <>
      <path d="M25 63c1-20 10-31 23-31s22 11 23 31Z" fill={palette.body} />
      <path d="M48 32c13 0 22 11 23 31H48Z" fill={palette.side} opacity=".75" />
      <path d="M31 62c2-13 8-21 17-21s15 8 17 21" fill="none" stroke={palette.accent} strokeWidth="3" opacity=".9" />
      <path d="M48 34v28M28 57h40" stroke={palette.accent} strokeWidth="2" opacity=".75" />
      {id === 'grand-observatory' && <path d="m48 32 14-13 4 3-10 17Z" fill={palette.roof} />}
      {id === 'spaceport' && <path d="m48 19 7 17-7 8-7-8Z" fill={palette.accent} />}
    </>
  )
}

function BuildingShape({ building }: { building: BuildingType }) {
  const palette = PALETTES[building.category]
  const tall = TALL_BUILDINGS.has(building.id)

  if (building.category === 'nature') {
    return <NatureSprite id={building.id} accent={palette.accent} />
  }

  if (DOME_BUILDINGS.has(building.id)) {
    return <DomeSprite palette={palette} id={building.id} />
  }

  const top = tall ? 17 : 31
  const bottom = 67
  const left = tall ? 32 : 27
  const right = tall ? 64 : 69

  return (
    <>
      <path d={`M${left} ${top + 9} 48 ${top} ${right} ${top + 9} 48 ${top + 18}Z`} fill={palette.roof} />
      <path d={`M${left} ${top + 9} 48 ${top + 18}v${bottom - top - 18}L${left} ${bottom - 9}Z`} fill={palette.body} />
      <path d={`M${right} ${top + 9} 48 ${top + 18}v${bottom - top - 18}l${right - 48}-${9}Z`} fill={palette.side} />
      {Array.from({ length: tall ? 3 : 2 }, (_, row) => (
        <g key={row}>
          <path d={`m${left + 6} ${top + 20 + row * 11} 7 3v7l-7-3Z`} fill={palette.accent} />
          <path d={`m${right - 13} ${top + 23 + row * 11} 7-3v7l-7 3Z`} fill={palette.accent} opacity=".8" />
        </g>
      ))}
      <path d={`m44 ${bottom - 13} 8 4v13l-8-4Z`} fill="#59473D" />
      {building.id === 'hospital' && (
        <path d="M44 26h8v6h6v8h-6v6h-8v-6h-6v-8h6Z" fill="#F5F0E5" />
      )}
      {building.id === 'castle' || building.id === 'sky-citadel' ? (
        <>
          <path d="M27 30V18h7v5h7v-5h7v19Z" fill={palette.roof} />
          <path d="M55 25V14h7v5h7v-5h7v24Z" fill={palette.roof} />
        </>
      ) : null}
      {building.id === 'orbital-elevator' && (
        <>
          <path d="M46 18V4h4v14Z" fill={palette.accent} />
          <ellipse cx="48" cy="9" rx="12" ry="4" fill="none" stroke={palette.accent} strokeWidth="3" />
        </>
      )}
    </>
  )
}

export function BuildingSprite({ building, className, muted = false }: BuildingSpriteProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={building.name}
      className={cn('overflow-visible drop-shadow-[0_5px_4px_rgb(35_67_49_/_0.18)]', muted && 'grayscale opacity-55', className)}
    >
      <GroundTile />
      <BuildingShape building={building} />
    </svg>
  )
}

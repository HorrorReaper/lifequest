export function getLevel(xp: number): number {
  return Math.floor(xp / 500) + 1
}

export function getCityTier(level: number): string {
  if (level <= 5) return 'village'
  if (level <= 10) return 'town'
  if (level <= 20) return 'city'
  if (level <= 35) return 'metropolis'
  return 'capital'
}

//wie 
export function xpToNextLevel(xp: number): number {
  return 500 - (xp % 500)
}

export function getXpProgress(xp: number): number {
  return (xp % 500) / 500
}

export const CITY_TIER_LABELS: Record<string, string> = {
  village: '🏕️ Village',
  town: '🏘️ Town',
  city: '🏙️ City',
  metropolis: '🌆 Metropolis',
  capital: '👑 Capital',
}
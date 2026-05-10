import { xpForLevel } from "./city";

/*export function getLevel(xp: number): number {
  return Math.floor(xp / 500) + 1
}*/
export function getLevel(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}
export function xpToNextLevel(level: number): number {
  // Each level requires more XP: 50, 150, 300, 500, 750, 1000, ...
  return Math.round(25 * level * level + 25 * level);
}

export function getCityTier(level: number): string {
  if (level <= 5) return 'village'
  if (level <= 10) return 'town'
  if (level <= 20) return 'city'
  if (level <= 35) return 'metropolis'
  return 'capital'
}

//wie 
/*
export function xpToNextLevel(xp: number): number {
  return 500 - (xp % 500)
}*/

/*export function getXpProgress(xp: number): number {
  return (xp % 500) / 500
}*/
export function getXpProgress(xp: number): { current: number; next: number; pct: number } {
  const level = getLevel(xp);
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const pct = next === current ? 100 : Math.round(((xp - current) / (next - current)) * 100);
  return { current, next, pct };
}
export const CITY_TIER_LABELS: Record<string, string> = {
  village: '🏕️ Village',
  town: '🏘️ Town',
  city: '🏙️ City',
  metropolis: '🌆 Metropolis',
  capital: '👑 Capital',
}
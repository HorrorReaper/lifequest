/**
 * XP & Level progression system.
 *
 * XP required per level follows a gentle curve:
 *   xpForLevel(n) = 50 + (n - 1) * 25
 *
 * Level 1:  50 XP
 * Level 2:  75 XP
 * Level 5: 150 XP
 * Level 10: 275 XP
 * Level 20: 525 XP
 * Level 50: 1275 XP
 *
 * Total XP to reach level n = sum of all prior levels.
 */

export function xpRequiredForLevel(level: number): number {
  return 50 + (level - 1) * 25;
}

export function totalXpForLevel(level: number): number {
  // Sum of arithmetic series: sum = n/2 * (2a + (n-1)d)
  // a = 50, d = 25, n = level - 1 (levels completed)
  if (level <= 1) return 0;
  const n = level - 1;
  return (n * (2 * 50 + (n - 1) * 25)) / 2;
}

export function getLevelFromTotalXp(totalXp: number): {
  level: number;
  currentLevelXp: number;
  xpToNextLevel: number;
  progressPercent: number;
} {
  let level = 1;
  let xpRemaining = totalXp;

  while (xpRemaining >= xpRequiredForLevel(level)) {
    xpRemaining -= xpRequiredForLevel(level);
    level++;
  }

  const needed = xpRequiredForLevel(level);
  return {
    level,
    currentLevelXp: xpRemaining,
    xpToNextLevel: needed,
    progressPercent: Math.round((xpRemaining / needed) * 100),
  };
}

export function getCityTierForLevel(level: number): string {
  if (level >= 36) return 'capital';
  if (level >= 21) return 'metropolis';
  if (level >= 11) return 'city';
  if (level >= 6) return 'town';
  return 'village';
}

export const TIER_CONFIG: Record<
  string,
  { label: string; emoji: string; color: string; minLevel: number }
> = {
  village:    { label: 'Village',    emoji: '🏕️', color: '#a3e635', minLevel: 1 },
  town:       { label: 'Town',       emoji: '🏘️', color: '#38bdf8', minLevel: 6 },
  city:       { label: 'City',       emoji: '🏙️', color: '#a78bfa', minLevel: 11 },
  metropolis: { label: 'Metropolis', emoji: '🌆', color: '#fb923c', minLevel: 21 },
  capital:    { label: 'Capital',    emoji: '👑', color: '#facc15', minLevel: 36 },
};

import { xpForLevel } from "./city";
import { XpRule, FieldType } from "./types";

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
// XP rules engine for journal fields

export function evaluateXpRules(
  fieldType: FieldType,
  fieldValue: unknown,
  rules: XpRule[]
): number {
  if (!rules || rules.length === 0) return 0;
  let totalXp = 0;

  for (const rule of rules) {
    if (matchesRule(fieldValue, rule)) {
      totalXp += rule.xp;
    }
  }
  return totalXp;
}

function matchesRule(value: unknown, rule: XpRule): boolean {
  switch (rule.operator) {
    case "is_checked":
      return value === true || value === "yes";
    case "is_not_checked":
      return value === false || value === "no" || !value;
    case "equals":
      return String(value).toLowerCase() === String(rule.value).toLowerCase();
    case "not_equals":
      return String(value).toLowerCase() !== String(rule.value).toLowerCase();
    case "greater_than":
      return typeof value === "number" && value > Number(rule.value);
    case "less_than":
      return typeof value === "number" && value < Number(rule.value);
    case "contains":
      return typeof value === "string" &&
        value.toLowerCase().includes(String(rule.value).toLowerCase());
    default:
      return false;
  }
}

/** Aggregate XP across all fields for an entry */
export function calculateEntryBonusXp(
  templateFields: Array<{ id: string; field_type: FieldType; xp_rules?: XpRule[] }>,
  fieldValues: Record<string, unknown>
): number {
  let total = 0;
  for (const field of templateFields) {
    if (!field.xp_rules || field.xp_rules.length === 0) continue;
    total += evaluateXpRules(field.field_type, fieldValues[field.id], field.xp_rules);
  }
  return total;
}

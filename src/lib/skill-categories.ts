import type { SupabaseClient } from "@supabase/supabase-js";

export type SkillCategory =
  | "physical_health"
  | "mental_health"
  | "focus"
  | "learning"
  | "relationships"
  | "career";

export interface SkillCategoryDef {
  id: SkillCategory;
  label: string;
  emoji: string;
}

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  { id: "physical_health", label: "Physical Health", emoji: "💪" },
  { id: "mental_health", label: "Mental Health", emoji: "🧘" },
  { id: "focus", label: "Focus", emoji: "🎯" },
  { id: "learning", label: "Learning", emoji: "📚" },
  { id: "relationships", label: "Relationships", emoji: "🤝" },
  { id: "career", label: "Career", emoji: "💼" },
];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> =
  Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category.id, category.label])
  ) as Record<SkillCategory, string>;

export async function fetchSkillXpTotals(
  supabase: SupabaseClient,
  userId: string
): Promise<Record<SkillCategory, number>> {
  const totals = Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category.id, 0])
  ) as Record<SkillCategory, number>;

  const { data, error } = await supabase
    .from("xp_events")
    .select("skill_category, xp_amount")
    .eq("user_id", userId);
  if (error) throw error;

  for (const row of data ?? []) {
    const category = row.skill_category as SkillCategory | null;
    if (category && category in totals) {
      totals[category] += row.xp_amount as number;
    }
  }

  return totals;
}

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

import { describe, expect, it } from "vitest";
import { SKILL_CATEGORIES, SKILL_CATEGORY_LABELS, type SkillCategory } from "./skill-categories";

describe("skill categories", () => {
  it("has exactly 6 categories with unique ids", () => {
    expect(SKILL_CATEGORIES).toHaveLength(6);
    const ids = SKILL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("has a label for every category, matching SKILL_CATEGORY_LABELS", () => {
    for (const category of SKILL_CATEGORIES) {
      expect(category.label.length).toBeGreaterThan(0);
      expect(SKILL_CATEGORY_LABELS[category.id]).toBe(category.label);
    }
  });

  it("has a non-empty emoji for every category", () => {
    for (const category of SKILL_CATEGORIES) {
      expect(category.emoji.length).toBeGreaterThan(0);
    }
  });

  it("includes the six expected category ids", () => {
    const ids = SKILL_CATEGORIES.map((c) => c.id) as SkillCategory[];
    expect(ids).toEqual(
      expect.arrayContaining([
        "physical_health",
        "mental_health",
        "focus",
        "learning",
        "relationships",
        "career",
      ])
    );
  });
});

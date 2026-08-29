import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SKILL_CATEGORIES,
  SKILL_CATEGORY_LABELS,
  fetchSkillXpTotals,
  type SkillCategory,
} from "./skill-categories";

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

describe("fetchSkillXpTotals", () => {
  it("sums xp_amount per skill_category and defaults untouched categories to 0", async () => {
    const rows = [
      { skill_category: "physical_health", xp_amount: 10 },
      { skill_category: "physical_health", xp_amount: 15 },
      { skill_category: "focus", xp_amount: 20 },
      { skill_category: null, xp_amount: 5 },
    ];
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: rows, error: null }),
        }),
      }),
    } as unknown as SupabaseClient;

    const totals = await fetchSkillXpTotals(client, "user-1");

    expect(totals).toEqual({
      physical_health: 25,
      mental_health: 0,
      focus: 20,
      learning: 0,
      relationships: 0,
      career: 0,
    });
  });

  it("throws when the query errors", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: null, error: new Error("boom") }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(fetchSkillXpTotals(client, "user-1")).rejects.toThrow("boom");
  });
});

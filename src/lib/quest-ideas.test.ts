import { describe, expect, it } from "vitest";
import {
  QUEST_IDEA_CATEGORIES,
  QUEST_IDEAS,
  skillCategoryForQuestIdeaCategory,
} from "@/lib/quest-ideas";

describe("quest ideas", () => {
  it("has 30 ideas", () => {
    expect(QUEST_IDEAS).toHaveLength(30);
  });

  it("has unique ids", () => {
    const ids = QUEST_IDEAS.map((idea) => idea.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses declared categories", () => {
    for (const idea of QUEST_IDEAS) {
      expect(QUEST_IDEA_CATEGORIES).toContain(idea.category);
    }
  });

  it("has every declared category represented", () => {
    const usedCategories = new Set(QUEST_IDEAS.map((idea) => idea.category));
    for (const category of QUEST_IDEA_CATEGORIES) {
      expect(usedCategories.has(category)).toBe(true);
    }
  });

  it("has positive rewards and non-empty title/description for every idea", () => {
    for (const idea of QUEST_IDEAS) {
      expect(idea.title.trim().length).toBeGreaterThan(0);
      expect(idea.description.trim().length).toBeGreaterThan(0);
      expect(idea.xpReward).toBeGreaterThan(0);
      expect(idea.coinReward).toBeGreaterThan(0);
    }
  });
});

describe("skillCategoryForQuestIdeaCategory", () => {
  it("maps each quest-idea category to the expected skill category", () => {
    expect(skillCategoryForQuestIdeaCategory("Skills & Learning")).toBe("learning");
    expect(skillCategoryForQuestIdeaCategory("Creative & Technical")).toBe("focus");
    expect(skillCategoryForQuestIdeaCategory("Adventure & Travel")).toBe("mental_health");
    expect(skillCategoryForQuestIdeaCategory("Health & Fitness")).toBe("physical_health");
    expect(skillCategoryForQuestIdeaCategory("Money & Career")).toBe("career");
    expect(skillCategoryForQuestIdeaCategory("Relationships & Community")).toBe("relationships");
  });

  it("covers every category in QUEST_IDEA_CATEGORIES with no gaps", () => {
    for (const category of QUEST_IDEA_CATEGORIES) {
      expect(() => skillCategoryForQuestIdeaCategory(category)).not.toThrow();
    }
  });
});

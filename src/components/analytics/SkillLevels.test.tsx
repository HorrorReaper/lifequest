import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLevels } from "./SkillLevels";
import type { SkillCategory } from "@/lib/skill-categories";

afterEach(cleanup);

describe("SkillLevels", () => {
  it("renders all 6 categories, including ones with zero XP", () => {
    const totals: Record<SkillCategory, number> = {
      physical_health: 120,
      mental_health: 0,
      focus: 45,
      learning: 0,
      relationships: 0,
      career: 0,
    };
    render(<SkillLevels totals={totals} />);

    expect(screen.getByText("Physical Health")).toBeTruthy();
    expect(screen.getByText("Mental Health")).toBeTruthy();
    expect(screen.getByText("Focus")).toBeTruthy();
    expect(screen.getByText("Learning")).toBeTruthy();
    expect(screen.getByText("Relationships")).toBeTruthy();
    expect(screen.getByText("Career")).toBeTruthy();
  });

  it("shows level 1 for a category with zero XP", () => {
    const totals: Record<SkillCategory, number> = {
      physical_health: 0,
      mental_health: 0,
      focus: 0,
      learning: 0,
      relationships: 0,
      career: 0,
    };
    render(<SkillLevels totals={totals} />);
    const levelLabels = screen.getAllByText(/level 1/i);
    expect(levelLabels.length).toBe(6);
  });
});

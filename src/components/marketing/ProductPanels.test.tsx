import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  DashboardPanel,
  ReflectionPanel,
  TemplatesPanel,
} from "@/components/marketing/ProductPanels";
import { REFLECTION_PROMPTS } from "@/lib/daily-reflection";

afterEach(cleanup);

// The counters tween over 600ms, and jsdom's requestAnimationFrame runs
// slower than wall clock, so waiting for a settled number needs more than
// findBy's default second.
const SETTLED = { timeout: 3000 };

describe("DashboardPanel", () => {
  it("shows the level band the app's own curve produces", () => {
    render(<DashboardPanel />);

    // xpForLevel(7) = 25·49 + 25·7 = 1400. A number that does not come from
    // that curve would make the bar a lie the moment anyone checked.
    expect(screen.getByText(/1,240 \/ 1,400 XP to level 7/)).toBeTruthy();
  });

  it("pays the habit's real XP and coins when it is ticked", async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    expect(screen.getByText(/86 coins/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /move for 20 minutes/i }));

    // round(10 × (1 + 12×0.02)) = 12 XP, and a flat 3 coins.
    expect(await screen.findByText(/1,252 \/ 1,400 XP to level 7/, undefined, SETTLED)).toBeTruthy();
    expect(await screen.findByText(/89 coins/, undefined, SETTLED)).toBeTruthy();
  });

  it("pays a completed task 5 XP and no coins", async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    await user.click(screen.getByRole("button", { name: /send the project update/i }));

    expect(await screen.findByText(/1,245 \/ 1,400 XP to level 7/, undefined, SETTLED)).toBeTruthy();
    // Tasks pay no coins in the app, so the balance must not move.
    expect(screen.getByText(/86 coins/)).toBeTruthy();
  });

  it("puts everything back with Reset", async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    await user.click(screen.getByRole("button", { name: /move for 20 minutes/i }));
    await user.click(screen.getByRole("button", { name: /reset/i }));

    expect(await screen.findByText(/1,240 \/ 1,400 XP to level 7/, undefined, SETTLED)).toBeTruthy();
    expect(await screen.findByText(/86 coins/, undefined, SETTLED)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /move for 20 minutes/i }).getAttribute("aria-pressed")
    ).toBe("false");
  });
});

describe("TemplatesPanel", () => {
  it("swaps the fields and the XP when another template is picked", async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("+25 XP")).toBeTruthy();
    expect(within(panel).getByText(/what was my biggest win today/i)).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /weekly review/i }));

    expect(within(panel).getByText("+50 XP")).toBeTruthy();
    expect(within(panel).queryByText(/what was my biggest win today/i)).toBeNull();
  });

  it("marks exactly one tab selected at a time", async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);

    await user.click(screen.getByRole("tab", { name: /quick insight/i }));

    const selected = screen
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("aria-selected") === "true");

    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toMatch(/quick insight/i);
  });
});

describe("ReflectionPanel", () => {
  it("draws a different question from the authored list", async () => {
    const user = userEvent.setup();
    render(<ReflectionPanel />);

    const texts = REFLECTION_PROMPTS.map((prompt) => prompt.text);
    const first = texts.find((text) => screen.queryByText(text));
    expect(first).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /another one/i }));

    const second = texts.find((text) => screen.queryByText(text));
    expect(second).toBeTruthy();
    // randomReflectionPrompt excludes the current id, so a click always moves.
    expect(second).not.toBe(first);
  });

  it("names how many questions the rotation holds", () => {
    render(<ReflectionPanel />);

    expect(
      screen.getByText(new RegExp(`${REFLECTION_PROMPTS.length} questions`))
    ).toBeTruthy();
  });
});

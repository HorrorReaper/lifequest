import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import {
  DashboardPanel,
  ReflectionPanel,
  StreakPanel,
  TemplatesPanel,
} from "@/components/marketing/ProductPanels";
import { REFLECTION_PROMPTS } from "@/lib/daily-reflection";
import { calculateHabitCheckInXp } from "@/lib/habit-xp";

afterEach(cleanup);

// The counters tween over 600ms, and jsdom's requestAnimationFrame runs
// slower than wall clock, so waiting for a settled number needs more than
// findBy's default second.
const SETTLED = { timeout: 3000 };

describe("DashboardPanel", () => {
  it("counts down to the next level the way the app's heroes do", () => {
    render(<DashboardPanel />);

    // xpForLevel(7) = 25·49 + 25·7 = 1400, and the panel sits at 1,240, so 160
    // are left. Phrased as what remains, not as a fraction of a total, because
    // that is what TrailDashboardHero and DashboardHero both print.
    expect(screen.getByText(/^160 XP to Level 7$/)).toBeTruthy();
  });

  it("pays the habit's real XP and coins when it is ticked", async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    expect(screen.getByText(/86 coins/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /move for 20 minutes/i }));

    // round(10 × (1 + 12×0.02)) = 12 XP, so 160 left becomes 148, and a flat
    // 3 coins on top.
    expect(await screen.findByText(/^148 XP to Level 7$/, undefined, SETTLED)).toBeTruthy();
    expect(await screen.findByText(/89 coins/, undefined, SETTLED)).toBeTruthy();
  });

  it("pays a completed task 5 XP and no coins", async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    await user.click(screen.getByRole("button", { name: /send the project update/i }));

    expect(await screen.findByText(/^155 XP to Level 7$/, undefined, SETTLED)).toBeTruthy();
    // Tasks pay no coins in the app, so the balance must not move.
    expect(screen.getByText(/86 coins/)).toBeTruthy();
  });

  it("puts everything back with Reset", async () => {
    const user = userEvent.setup();
    render(<DashboardPanel />);

    await user.click(screen.getByRole("button", { name: /move for 20 minutes/i }));
    await user.click(screen.getByRole("button", { name: /reset/i }));

    expect(await screen.findByText(/^160 XP to Level 7$/, undefined, SETTLED)).toBeTruthy();
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

  it("quotes the seeded templates rather than inventing fields", async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).queryByText("What is my ONE most important task today?")).toBeNull();

    await user.click(screen.getByRole("tab", { name: /morning reflection/i }));
    expect(within(panel).getByText("What is my ONE most important task today?")).toBeTruthy();
    expect(within(panel).getByText("Today's positive affirmation")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /weekly review/i }));
    expect(within(panel).getByText("Next week's theme or focus")).toBeTruthy();
    expect(within(panel).getByText("Free reflection")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: /quick insight/i }));
    expect(within(panel).getByText("One insight or thought worth remembering")).toBeTruthy();
    expect(within(panel).getByText("+5 XP")).toBeTruthy();
  });

  it("keeps the panel tall enough for the longest template", async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);

    // Otherwise clicking from a seven-field template to a one-field one drops
    // the panel by a couple of hundred pixels and shoves the page around.
    const fieldsOf = () =>
      screen.getByRole("tabpanel").querySelector<HTMLElement>("[style*='min-height']");

    await user.click(screen.getByRole("tab", { name: /morning reflection/i }));
    const tall = fieldsOf()?.style.minHeight;

    await user.click(screen.getByRole("tab", { name: /quick insight/i }));
    expect(fieldsOf()?.style.minHeight).toBe(tall);
    expect(tall).toBeTruthy();
  });

  it("marks exactly one tab selected at a time", async () => {
    const user = userEvent.setup();
    render(<TemplatesPanel />);

    await user.click(screen.getByRole("tab", { name: /morning reflection/i }));

    const selected = screen
      .getAllByRole("tab")
      .filter((tab) => tab.getAttribute("aria-selected") === "true");

    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toMatch(/morning reflection/i);
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

describe("StreakPanel", () => {
  it("pays each habit what the app pays at the streak it shows", () => {
    // The panel states a streak length; the XP beside each habit has to be
    // what calculateHabitCheckInXp returns for that streak, not a typed
    // number that drifts when the formula changes.
    render(<StreakPanel />);
    const streakLabel = screen.getByText(/days running/).textContent ?? "";
    const streak = Number(streakLabel.match(/\d+/)?.[0]);
    const expected = calculateHabitCheckInXp(streak).xp;
    expect(screen.getAllByText(`+${expected} XP`).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\+20 XP/)).toBeNull();
  });
});

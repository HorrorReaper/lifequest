import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPlanner } from "@/components/planning/TodayPlanner";
import {
  createDefaultTodayPlanMetadata,
  serializeTodayPlanNotes,
} from "@/lib/today-plan";

const push = vi.fn();
const refresh = vi.fn();
const upsertDayPlan = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ client: true }),
}));

vi.mock("@/lib/day-plans", () => ({
  upsertDayPlan: (...args: unknown[]) => upsertDayPlan(...args),
}));

const defaultProps = {
  userId: "user-1",
  date: "2026-07-25",
  dateLabel: "Saturday, July 25",
  initialBlocks: [],
  initialNotes: null,
  tasks: [
    {
      id: "task-1",
      title: "Write launch brief",
      dueDate: "2026-07-25",
      priority: "high" as const,
      isOverdue: false,
      estimateMinutes: 60,
    },
  ],
  habits: [
    {
      id: "habit-1",
      name: "Read",
      emoji: "📚",
      completedToday: false,
    },
  ],
  journals: [],
  workoutsEnabled: false,
};

beforeEach(() => {
  sessionStorage.clear();
  upsertDayPlan.mockResolvedValue({});
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("TodayPlanner", () => {
  const next = () =>
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

  /** Clears the mood step, which no longer lets anyone through unanswered. */
  const pickMood = () => {
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    next();
  };

  it("blocks progress until a mood is chosen", () => {
    render(<TodayPlanner {...defaultProps} />);

    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "Pick how you are feeling"
    );
    expect(
      screen.getByRole("heading", { name: "How are you feeling right now?" })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    next();

    expect(
      screen.getByRole("heading", { name: "What quality should guide today?" })
    ).toBeTruthy();
  });

  it("marks the chosen mood as pressed", () => {
    render(<TodayPlanner {...defaultProps} />);

    const good = screen.getByRole("button", { name: /good/i });
    expect(good.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(good);
    expect(good.getAttribute("aria-pressed")).toBe("true");
  });

  it("asks mood and intention on their own steps", () => {
    render(<TodayPlanner {...defaultProps} />);

    // The intention field is not reachable until the mood step is done.
    expect(screen.queryByRole("textbox")).toBeNull();
    pickMood();
    expect(
      screen.getByRole("textbox", { name: "What quality should guide today?" })
    ).toBeTruthy();

    next();
    expect(
      screen.getByRole("heading", { name: "Set up your Top Three for Today" })
    ).toBeTruthy();
  });

  it("blocks progress until a Must Win is selected", () => {
    render(<TodayPlanner {...defaultProps} />);

    pickMood();
    next();
    expect(
      screen.getByRole("heading", { name: "Set up your Top Three for Today" })
    ).toBeTruthy();

    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "Choose one Must Win"
    );
  });

  it("builds the timeline and performs one final write", async () => {
    render(<TodayPlanner {...defaultProps} />);

    pickMood();
    next();
    fireEvent.focus(screen.getByLabelText("Must Win outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: /Read/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByLabelText(/Write launch brief, \d\d:\d\d to \d\d:\d\d/)
    ).toBeTruthy();
    // The habit rides along instead of taking a slot: it shows up in the rail,
    // never as an editable block with its own start and end time.
    expect(screen.queryByDisplayValue("📚 Read")).toBeNull();
    expect(screen.getByText("Rides along")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Commit Today's Plan/i })
    );

    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    expect(upsertDayPlan.mock.calls[0][2]).toMatchObject({
      plan_date: "2026-07-25",
    });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("gives Progress and Health their own task combobox instead of a shared sidebar", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    expect(screen.queryByText("Pull from tasks")).toBeNull();

    fireEvent.focus(screen.getByLabelText("Progress outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));

    expect(screen.getByLabelText("Progress outcome")).toHaveProperty(
      "value",
      "Write launch brief"
    );
    expect(screen.getByLabelText("Health outcome")).toHaveProperty("value", "");
  });

  it("restores an unfinished tab-local draft", async () => {
    const first = render(<TodayPlanner {...defaultProps} />);
    pickMood();
    fireEvent.change(
      screen.getByRole("textbox", { name: "What quality should guide today?" }),
      { target: { value: "Calm execution" } }
    );

    await waitFor(() =>
      expect(
        sessionStorage.getItem("lifequest:today-plan:user-1:2026-07-25")
      ).toContain("Calm execution")
    );
    first.unmount();

    render(<TodayPlanner {...defaultProps} />);

    expect(
      screen.getByText("Your unfinished plan was restored.")
    ).toBeTruthy();
    // A restored draft reopens at the first step, so the recovered intention
    // is one step in -- the mood came back with it and lets us straight past.
    await waitFor(() => next());
    expect(screen.getByDisplayValue("Calm execution")).toBeTruthy();
  });

  // Starting on the timeline step: a Must Win already chosen so step 1
  // validates, and its block already present so the schedule builder has
  // nothing left to append.
  const timelineProps = {
    ...defaultProps,
    initialNotes: serializeTodayPlanNotes({
      ...createDefaultTodayPlanMetadata(),
      outcomes: [
        {
          id: "main",
          role: "must_win" as const,
          title: "Write launch brief",
          task_id: null,
          duration_minutes: 60,
        },
      ],
    }),
    initialBlocks: [
      {
        id: "a",
        start_time: "08:00",
        end_time: "09:00",
        title: "Write launch brief",
        category: "deep_work" as const,
        mission_type: "main_quest" as const,
        outcome_role: "must_win" as const,
      },
      {
        id: "b",
        start_time: "09:15",
        end_time: "10:00",
        title: "Side quest",
        category: "deep_work" as const,
      },
      {
        id: "c",
        start_time: "11:00",
        end_time: "11:45",
        title: "Training",
        category: "exercise" as const,
      },
    ],
  };

  function gotoTimeline() {
    pickMood();
    next();
    next();
    next();
  }

  it("names the ride-along habits without giving them a time slot", () => {
    render(<TodayPlanner {...defaultProps} />);

    pickMood();
    next();
    fireEvent.focus(screen.getByLabelText("Must Win outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    next();
    fireEvent.click(screen.getByRole("button", { name: /Read/ }));
    next();

    const rail = screen.getByText("Rides along").parentElement as HTMLElement;
    expect(rail.textContent).toContain("Read");
    expect(rail.textContent).toContain("No time slot needed");
  });

  it("draws a block as tall as it is long, and where it starts", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const px = (el: HTMLElement, prop: "height" | "top") =>
      Number.parseFloat(el.style[prop]);

    const a = screen.getByLabelText("Write launch brief, 08:00 to 09:00");
    const b = screen.getByLabelText("Side quest, 09:15 to 10:00");
    const c = screen.getByLabelText("Training, 11:00 to 11:45");

    // 60 minutes must be exactly a third taller than 45. This proportion is
    // the whole point of the axis: the old card list drew them identically.
    expect(px(a, "height") / px(b, "height")).toBeCloseTo(60 / 45, 5);
    expect(px(b, "height")).toBeCloseTo(px(c, "height"), 5);

    // The day opens at 08:00, so the first block sits at the very top and the
    // others are offset by their real distance from it.
    expect(px(a, "top")).toBe(0);
    expect(px(b, "top") / px(a, "height")).toBeCloseTo(75 / 60, 5);
    expect(px(c, "top") / px(a, "height")).toBeCloseTo(180 / 60, 5);
  });

  it("offers to fill each stretch of free time, sized to what fits", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    // 09:00-09:15 between the first two, 10:00-11:00 before the third, and
    // everything after it up to the end of the planned day.
    expect(
      screen.getByLabelText("Add a block between 09:00 and 09:15")
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Add a block between 10:00 and 11:00")
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Add a block between 11:45 and 18:00")
    ).toBeTruthy();

    // The affordance names the length it would actually create.
    expect(
      screen.getByLabelText("Add a block between 09:00 and 09:15").textContent
    ).toContain("15m");
    expect(
      screen.getByLabelText("Add a block between 11:45 and 18:00").textContent
    ).toContain("1h");
  });

  it("fits the new block to a gap shorter than an hour", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add a block between 09:00 and 09:15"));

    expect(screen.getByLabelText("New plan block, 09:00 to 09:15")).toBeTruthy();
  });

  it("runs an hour from where the click landed when there is room", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    // jsdom reports a zero-origin rect, so clientY is the offset from the top
    // of the track: 300 minutes past 08:00 at 1.2px per minute is 13:00.
    fireEvent.click(
      screen.getByLabelText("Add a block between 11:45 and 18:00"),
      { clientY: 360 }
    );

    expect(screen.getByLabelText("New plan block, 13:00 to 14:00")).toBeTruthy();
  });

  it("selects the block it just created so it can be named", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add a block between 09:00 and 09:15"));

    const title = screen.getByLabelText("Block title");
    expect(title).toHaveProperty("value", "New plan block");
  });

  it("adds into free time without pushing the rest of the day around", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add a block between 10:00 and 11:00"));

    // Filling a gap cannot collide, so nothing after it may move.
    expect(screen.getByLabelText("Training, 11:00 to 11:45")).toBeTruthy();
    expect(screen.getByLabelText("Side quest, 09:15 to 10:00")).toBeTruthy();
    expect(screen.queryByText("Two blocks want the same minutes.")).toBeNull();
  });

  it("stops offering a gap once it is filled", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add a block between 09:00 and 09:15"));

    expect(
      screen.queryByLabelText("Add a block between 09:00 and 09:15")
    ).toBeNull();
  });

  it("moves every later block when one is retimed", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText(/Write launch brief, 08:00 to 09:00/));
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "08:30" },
    });

    // The axis is the source of truth now, so assert on what it announces.
    expect(screen.getByLabelText("Write launch brief, 08:30 to 09:30")).toBeTruthy();
    expect(screen.getByLabelText("Side quest, 09:45 to 10:30")).toBeTruthy();
    expect(screen.getByLabelText("Training, 11:30 to 12:15")).toBeTruthy();
  });

  it("moves a block with the arrow keys, for anyone not using a pointer", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const block = screen.getByLabelText("Side quest, 09:15 to 10:00");
    fireEvent.keyDown(block, { key: "ArrowDown" });

    expect(screen.getByLabelText("Side quest, 09:20 to 10:05")).toBeTruthy();
    // Everything after it follows, exactly as a drag would.
    expect(screen.getByLabelText("Training, 11:05 to 11:50")).toBeTruthy();
  });

  it("resizes with shift and an arrow key without moving the start", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const block = screen.getByLabelText("Side quest, 09:15 to 10:00");
    fireEvent.keyDown(block, { key: "ArrowDown", shiftKey: true });

    expect(screen.getByLabelText("Side quest, 09:15 to 10:05")).toBeTruthy();
  });

  it("keeps a block reachable when its time cannot be placed on the axis", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText(/Side quest, 09:15 to 10:00/));
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "08:00" } });

    expect(screen.getByText("needs a valid time")).toBeTruthy();
  });

  it("offers to space out overlapping blocks instead of only refusing", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText(/Side quest, 09:15 to 10:00/));
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "08:30" },
    });
    expect(screen.getByText("Two blocks want the same minutes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Space them out" }));

    expect(screen.queryByText("Two blocks want the same minutes.")).toBeNull();
    // The pushed block keeps its 45 minutes, it just starts after the first.
    expect(screen.getByLabelText("Side quest, 09:15 to 10:00")).toBeTruthy();
  });
});

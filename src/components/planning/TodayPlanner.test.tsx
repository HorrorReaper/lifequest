import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

  it("asks for reasons only once there is a feeling to explain", () => {
    render(<TodayPlanner {...defaultProps} />);

    expect(screen.queryByText("What is behind that?")).toBeNull();
    expect(screen.queryByRole("button", { name: /adventure/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /good/i }));

    expect(screen.getByText("What is behind that?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /adventure/i })).toBeTruthy();
  });

  it("takes several reasons at once", () => {
    render(<TodayPlanner {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));

    const fitness = screen.getByRole("button", { name: /fitness/i });
    const friends = screen.getByRole("button", { name: /friends/i });
    expect(fitness.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(fitness);
    fireEvent.click(friends);

    expect(fitness.getAttribute("aria-pressed")).toBe("true");
    expect(friends.getAttribute("aria-pressed")).toBe("true");

    // And lets one go again without disturbing the other.
    fireEvent.click(fitness);
    expect(fitness.getAttribute("aria-pressed")).toBe("false");
    expect(friends.getAttribute("aria-pressed")).toBe("true");
  });

  it("does not require a reason to move on", () => {
    render(<TodayPlanner {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    next();

    expect(
      screen.getByRole("heading", { name: "What quality should guide today?" })
    ).toBeTruthy();
  });

  it("commits the reasons and the written one with the plan", async () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    fireEvent.click(screen.getByRole("button", { name: /adventure/i }));
    fireEvent.change(screen.getByLabelText("Something else"), {
      target: { value: "First frost this morning" },
    });
    next();

    next();
    fireEvent.focus(screen.getByLabelText("Must Win outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    next();
    next();
    next();
    fireEvent.click(
      screen.getByRole("button", { name: /Commit Today's Plan/i })
    );

    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    const notes = upsertDayPlan.mock.calls[0][2].notes as string;
    expect(notes).toContain("adventure");
    expect(notes).toContain("First frost this morning");
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

  it("keeps all three day boundaries editable in one place", () => {
    render(<TodayPlanner {...timelineProps} />);
    pickMood();
    next();
    next();

    expect(screen.getByLabelText("Day starts")).toHaveProperty("value", "08:00");
    expect(screen.getByLabelText("Day ends")).toHaveProperty("value", "18:00");

    const shutdown = screen.getByLabelText("Shutdown ritual");
    expect(shutdown).toHaveProperty("value", "18:00");

    fireEvent.change(shutdown, { target: { value: "17:30" } });
    expect(screen.getByLabelText("Shutdown ritual")).toHaveProperty(
      "value",
      "17:30"
    );
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

    // Nothing is drawn until a pointer says where.
    expect(
      screen.getByLabelText("Add a block between 11:45 and 18:00").textContent
    ).toBe("");
  });

  it("previews only the hour it would create, where the pointer is", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const gap = screen.getByLabelText("Add a block between 11:45 and 18:00");
    // jsdom reports a zero-origin rect, so clientY is the offset from the top
    // of the track: 348px at 1.2px per minute is 290 minutes past 08:00,
    // which is 12:50.
    fireEvent.mouseMove(gap, { clientY: 348 });

    const shown = gap.querySelector('[data-slot="gap-preview"]') as HTMLElement;
    expect(shown.textContent).toContain("12:00");
    expect(shown.textContent).toContain("13:00");
    // An hour tall, and no taller, however large the gap behind it is.
    expect(Number.parseFloat(shown.style.height)).toBeCloseTo(60 * 1.2, 5);
  });

  it("drops the preview back to the end of the blocking block", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const gap = screen.getByLabelText("Add a block between 11:45 and 18:00");
    // 264px is 220 minutes past 08:00, so 11:40 -- inside the 11:00 hour,
    // which the previous block occupies until 11:45.
    fireEvent.mouseMove(gap, { clientY: 264 });

    const shown = gap.querySelector('[data-slot="gap-preview"]') as HTMLElement;
    expect(shown.textContent).toContain("11:45");
    expect(shown.textContent).toContain("12:45");
  });

  it("clears the preview when the pointer leaves", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const gap = screen.getByLabelText("Add a block between 11:45 and 18:00");
    fireEvent.mouseMove(gap, { clientY: 348 });
    expect(gap.querySelector('[data-slot="gap-preview"]')).toBeTruthy();

    fireEvent.mouseLeave(gap);
    expect(gap.querySelector('[data-slot="gap-preview"]')).toBeNull();
  });

  it("previews from the top of the gap when reached by keyboard", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const gap = screen.getByLabelText("Add a block between 11:45 and 18:00");
    fireEvent.focus(gap);

    const shown = gap.querySelector('[data-slot="gap-preview"]') as HTMLElement;
    expect(shown.textContent).toContain("11:45");

    // Activating from the keyboard creates exactly what was previewed.
    fireEvent.click(gap, { detail: 0 });
    expect(screen.getByLabelText("New plan block, 11:45 to 12:45")).toBeTruthy();
  });

  it("fits the new block to a gap shorter than an hour", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add a block between 09:00 and 09:15"));

    expect(screen.getByLabelText("New plan block, 09:00 to 09:15")).toBeTruthy();
  });

  it("creates the hour the pointer is in, on the hour", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    // 348px is 290 minutes past 08:00, so 12:50 -- inside the 12:00 hour.
    fireEvent.click(
      screen.getByLabelText("Add a block between 11:45 and 18:00"),
      { clientY: 348, detail: 1 }
    );

    expect(screen.getByLabelText("New plan block, 12:00 to 13:00")).toBeTruthy();
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

  it("draws a short block at its real height, clear of the next one", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add a block between 09:00 and 09:15"));

    const px = (el: HTMLElement, prop: "height" | "top") =>
      Number.parseFloat(el.style[prop]);

    const short = screen.getByLabelText("New plan block, 09:00 to 09:15");
    const next = screen.getByLabelText("Side quest, 09:15 to 10:00");

    // 15 minutes at 1.2px each. Rounding this up to a readable minimum is
    // what used to push it under its neighbour.
    expect(px(short, "height")).toBeCloseTo(15 * 1.2, 5);
    expect(px(short, "top") + px(short, "height")).toBeLessThanOrEqual(
      px(next, "top")
    );
  });

  it("opens a block's properties over the day rather than under it", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText("Block title")).toBeNull();

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Edit block");
    expect(screen.getByLabelText("Block title")).toHaveProperty(
      "value",
      "Write launch brief"
    );
  });

  it("closes the properties again once the block is gone", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete Write launch brief" })
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByLabelText(/Write launch brief, 08:00 to 09:00/)
    ).toBeNull();
  });

  it("does not open the properties when a block was dragged, only tapped", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const block = screen.getByLabelText("Write launch brief, 08:00 to 09:00");
    // jsdom does not implement pointer capture; the handler only needs it not
    // to throw.
    block.setPointerCapture = () => {};

    fireEvent.pointerDown(block, { button: 0, pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(block, { pointerId: 1, clientY: 136 });
    fireEvent.pointerUp(block, { pointerId: 1, clientY: 136 });
    fireEvent.click(block);

    // 36px is 30 minutes, so the block moved -- and a move is not a tap.
    expect(screen.getByLabelText("Write launch brief, 08:30 to 09:30")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers the overlap fix inside the properties, where it is reachable", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Side quest, 09:15 to 10:00"));
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "08:30" },
    });

    // The banner behind the modal cannot be clicked, so the dialog carries it.
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Overlaps another block.");
    fireEvent.click(screen.getByRole("button", { name: "Space them out" }));

    expect(screen.getByLabelText("Side quest, 09:15 to 10:00")).toBeTruthy();
  });

  it("puts an add button within thumb reach on the timeline step", () => {
    render(<TodayPlanner {...timelineProps} />);
    // The footer button is the mobile one; the header keeps its own for
    // pointer widths, and CSS shows exactly one of them at a time.
    const footer = () =>
      within(document.querySelector("footer") as HTMLElement);

    pickMood();
    next();
    // Not on the earlier steps, where there is no timeline to add to.
    expect(footer().queryByRole("button", { name: "Add block" })).toBeNull();

    next();
    next();
    fireEvent.click(footer().getByRole("button", { name: "Add block" }));

    // Creating selects, so the properties open with the new block.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Block title")).toHaveProperty(
      "value",
      "New plan block"
    );
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

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { journalAnchorTitles, TodayPlanner } from "@/components/planning/TodayPlanner";
import {
  createDefaultTodayPlanMetadata,
  serializeTodayPlanNotes,
} from "@/lib/today-plan";

const push = vi.fn();
const refresh = vi.fn();
const upsertDayPlan = vi.fn();
const createTask = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ client: true }),
}));

vi.mock("@/lib/day-plans", () => ({
  upsertDayPlan: (...args: unknown[]) => upsertDayPlan(...args),
}));

vi.mock("@/lib/tasks", () => ({
  createTask: (...args: unknown[]) => createTask(...args),
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

  /** Opens the main focus picker and takes the existing task from it. */
  const pickMainTask = (title = "Write launch brief") => {
    fireEvent.click(screen.getByRole("button", { name: /Choose your main task/ }));
    fireEvent.click(screen.getByRole("option", { name: new RegExp(title) }));
  };

  /** Plans a main focus as plain text, without creating a task. */
  const planMainText = (title: string) => {
    fireEvent.click(screen.getByRole("button", { name: /Choose your main task/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search your tasks" }), {
      target: { value: title },
    });
    fireEvent.click(screen.getByRole("option", { name: /without a task/ }));
  };

  /** Reopens the picker of a filled main focus, where its block length is. */
  const reopenMain = () =>
    fireEvent.click(screen.getByRole("button", { name: /Change your main focus/ }));

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
    pickMainTask();
    next();
    next();
    next();
    fireEvent.click(
      screen.getByRole("button", { name: /Save today's plan/i })
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
      screen.getByRole("heading", { name: "What matters most today?" })
    ).toBeTruthy();
  });

  it("gives the main focus the weight and keeps recharge apart from the priorities", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    // "Must Win" beside a "Main Quest" badge was two names for one thing.
    expect(screen.queryByText("Must Win")).toBeNull();
    expect(screen.getByRole("heading", { name: "Your main focus" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Also worth doing/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "A moment to recharge" })).toBeTruthy();
    expect(screen.getByText("Make room for yourself, too.")).toBeTruthy();
    // One choice is required, said once; the second task is the optional one.
    expect(screen.getByText(/Required\. If you finish one thing today/)).toBeTruthy();
    expect(screen.getAllByText("Optional")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Choose a second task/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add a moment to recharge/ })).toBeTruthy();
    // No form on the page itself: every choice happens in the picker.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says nothing about an outcome that does not exist yet", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    // The old copy read "Standalone outcome" under three blank fields.
    expect(screen.queryByText("Standalone outcome")).toBeNull();
    expect(screen.queryByText(/Not saved as a task/)).toBeNull();

    planMainText("Ship the fix");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Ship the fix")).toBeTruthy();
    expect(screen.getByText("1h 30m · Not saved as a task")).toBeTruthy();
  });

  it("takes a block length to the minute, not just the presets", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    planMainText("Ship the fix");
    reopenMain();
    const field = () => screen.getByLabelText("Block length in minutes");
    expect(field()).toHaveProperty("value", "90");

    fireEvent.change(field(), { target: { value: "37" } });
    expect(field()).toHaveProperty("value", "37");
  });

  it("lets a number be typed digit by digit without clamping mid-way", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    planMainText("Ship the fix");
    reopenMain();
    const field = () => screen.getByLabelText("Block length in minutes");

    // "9" is below the minimum, but jumping it to 5 here would make "90"
    // impossible to finish typing.
    fireEvent.change(field(), { target: { value: "9" } });
    expect(field()).toHaveProperty("value", "9");

    fireEvent.change(field(), { target: { value: "90" } });
    expect(field()).toHaveProperty("value", "90");
  });

  it("snaps back to what is planned when a typed length is unusable", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    planMainText("Ship the fix");
    reopenMain();
    const field = () => screen.getByLabelText("Block length in minutes");

    fireEvent.change(field(), { target: { value: "900" } });
    fireEvent.blur(field());

    // Out of range never reached the outcome, so the field returns to the
    // number that is actually planned rather than showing a lie.
    expect(field()).toHaveProperty("value", "90");
  });

  it("keeps only digits", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    planMainText("Ship the fix");
    reopenMain();
    const field = screen.getByLabelText("Block length in minutes");
    fireEvent.change(field, { target: { value: "4h5" } });

    expect(field).toHaveProperty("value", "45");
  });

  it("carries the exact length through to the timeline block", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    pickMainTask();
    reopenMain();
    fireEvent.change(screen.getByLabelText("Block length in minutes"), {
      target: { value: "37" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // The overview shows the new length without reopening anything.
    expect(screen.getByText("37m · Due today")).toBeTruthy();

    next();
    next();

    // The day opens at 08:00 and this is the first block on it.
    expect(
      screen.getByLabelText("Write launch brief, 08:00 to 08:37")
    ).toBeTruthy();
  });

  it("opens a compact picker that searches the tasks and says when each is due", () => {
    render(
      <TodayPlanner
        {...defaultProps}
        tasks={[
          ...defaultProps.tasks,
          {
            id: "task-2",
            title: "Review pull request",
            dueDate: "2026-07-26",
            priority: "medium" as const,
            isOverdue: false,
            estimateMinutes: null,
          },
        ]}
      />
    );
    pickMood();
    next();

    fireEvent.click(screen.getByRole("button", { name: /Choose your main task/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Choose your main task" })).toBeTruthy();
    const search = within(dialog).getByRole("combobox", { name: "Search your tasks" });
    expect(search.getAttribute("placeholder")).toBe("Search tasks, or type a new one");
    expect(within(dialog).getByRole("option", { name: /Write launch brief.*Due today · 1h · High priority/ })).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: /Review pull request.*Due tomorrow/ })).toBeTruthy();

    fireEvent.change(search, { target: { value: "review" } });
    expect(within(dialog).queryByRole("option", { name: /Write launch brief/ })).toBeNull();
    expect(within(dialog).getByRole("option", { name: /Review pull request/ })).toBeTruthy();
  });

  it("blocks progress until a main focus is chosen", () => {
    render(<TodayPlanner {...defaultProps} />);

    pickMood();
    next();
    expect(
      screen.getByRole("heading", { name: "What matters most today?" })
    ).toBeTruthy();

    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "Choose your main focus"
    );
    expect(
      screen.getByRole("heading", { name: "What matters most today?" })
    ).toBeTruthy();

    pickMainTask();
    expect(screen.queryByRole("alert")).toBeNull();
    next();
    expect(
      screen.getByRole("heading", { name: "Add your daily anchors" })
    ).toBeTruthy();
  });

  it("shows the choice in the overview at once and hands focus back to the row", async () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    const row = screen.getByRole("button", { name: /Choose your main task/ });
    row.focus();
    fireEvent.click(row);
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
    const changed = screen.getByRole("button", { name: /Change your main focus: Write launch brief/ });
    expect(changed.textContent).toContain("1h · Due today");
    await waitFor(() => expect(document.activeElement).toBe(changed));
  });

  it("keeps one task from being both the main focus and the second task", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    pickMainTask();
    fireEvent.click(screen.getByRole("button", { name: /Choose a second task/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("option", { name: /Write launch brief/ })).toBeNull();
    // Typing its exact title does not slip it in either: it offers a new
    // task or plain text, never the one already in use.
    fireEvent.change(within(dialog).getByRole("combobox"), {
      target: { value: "Write launch brief" },
    });
    expect(
      within(dialog)
        .getAllByRole("option")
        .every((option) => !option.textContent?.includes("1h"))
    ).toBe(true);
  });

  it("changes and removes the optional second task", () => {
    render(
      <TodayPlanner
        {...defaultProps}
        tasks={[
          ...defaultProps.tasks,
          {
            id: "task-2",
            title: "Review pull request",
            dueDate: null,
            priority: "medium" as const,
            isOverdue: false,
            estimateMinutes: 25,
          },
        ]}
      />
    );
    pickMood();
    next();

    fireEvent.click(screen.getByRole("button", { name: /Choose a second task/ }));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    expect(screen.getByRole("button", { name: /Change your second task: Write launch brief/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Change your second task/ }));
    fireEvent.click(screen.getByRole("option", { name: /Review pull request/ }));
    expect(screen.getByRole("button", { name: /Change your second task: Review pull request/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove second task" }));
    expect(screen.getByRole("button", { name: /Choose a second task/ })).toBeTruthy();
    expect(screen.queryByText("Review pull request")).toBeNull();

    // And from inside the picker as well.
    fireEvent.click(screen.getByRole("button", { name: /Choose a second task/ }));
    fireEvent.click(screen.getByRole("option", { name: /Review pull request/ }));
    fireEvent.click(screen.getByRole("button", { name: /Change your second task/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from today" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Choose a second task/ })).toBeTruthy();
  });

  it("does not offer to remove the required main focus", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    pickMainTask();
    reopenMain();
    expect(screen.queryByRole("button", { name: "Remove from today" })).toBeNull();
  });

  it("adds a moment to recharge without making it a task, and removes it again", async () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();

    fireEvent.click(screen.getByRole("button", { name: /Add a moment to recharge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Go for a walk" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Change your recharge moment: Go for a walk/ })).toBeTruthy();
    expect(screen.getByText("45m set aside for it")).toBeTruthy();
    expect(createTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove recharge moment" }));
    expect(screen.getByRole("button", { name: /Add a moment to recharge/ })).toBeTruthy();
  });

  it("creates a new task from the picker and links it, leaving its due date alone", async () => {
    createTask.mockResolvedValue({
      id: "task-new",
      title: "Draft the pitch",
      due_date: null,
      priority: "medium",
    });
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    fireEvent.click(screen.getByRole("button", { name: /Choose your main task/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search your tasks" }), {
      target: { value: "Draft the pitch" },
    });
    fireEvent.click(screen.getByRole("option", { name: /Create task “Draft the pitch”/ }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Only a title: planning it into today does not make it due today.
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask.mock.calls[0][2]).toEqual({ title: "Draft the pitch" });
    expect(screen.getByRole("button", { name: /Change your main focus: Draft the pitch/ })).toBeTruthy();

    next();
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: /Save today's plan/i }));
    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    const saved = upsertDayPlan.mock.calls[0][2];
    expect(saved.notes).toContain("task-new");
    expect(saved.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Draft the pitch",
          source_type: "task",
          source_id: "task-new",
          outcome_role: "must_win",
        }),
      ])
    );
  });

  it("keeps the picker open with the reason when a task cannot be created", async () => {
    createTask.mockRejectedValue(new Error("offline"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();

    fireEvent.click(screen.getByRole("button", { name: /Choose your main task/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search your tasks" }), {
      target: { value: "Draft the pitch" },
    });
    fireEvent.click(screen.getByRole("option", { name: /Create task/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Could not create the task"
      )
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByDisplayValue("Draft the pitch")).toBeTruthy();
    quiet.mockRestore();
  });

  it("brings the chosen priorities back with a restored draft", async () => {
    const first = render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();
    await waitFor(() =>
      expect(
        sessionStorage.getItem("lifequest:today-plan:user-1:2026-07-25")
      ).toContain("task-1")
    );
    first.unmount();

    render(<TodayPlanner {...defaultProps} />);
    expect(screen.getByText("Your unfinished plan was restored.")).toBeTruthy();
    await waitFor(() => next());
    next();
    expect(
      screen.getByRole("button", { name: /Change your main focus: Write launch brief/ })
    ).toBeTruthy();
  });

  it("shows a plan's main focus written before tasks were linked", () => {
    render(
      <TodayPlanner
        {...defaultProps}
        initialNotes={serializeTodayPlanNotes({
          ...createDefaultTodayPlanMetadata(),
          mood: "good",
          outcomes: [
            {
              id: "old",
              role: "must_win",
              title: "Finish the quarterly report",
              task_id: null,
              duration_minutes: 120,
            },
          ],
        })}
      />
    );
    next();
    next();

    expect(
      screen.getByRole("button", { name: /Change your main focus: Finish the quarterly report/ }).textContent
    ).toContain("2h · Not saved as a task");
  });

  it.each(["/dashboard", "/admin/work"])("builds the same timeline, saves once and returns to %s", async (returnHref) => {
    render(<TodayPlanner {...defaultProps} returnHref={returnHref} embedded={returnHref === "/admin/work"} />);

    pickMood();
    next();
    pickMainTask();
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
      screen.getByRole("button", { name: /Save today's plan/i })
    );

    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    expect(upsertDayPlan.mock.calls[0][2]).toMatchObject({
      plan_date: "2026-07-25",
    });
    expect(push).toHaveBeenCalledWith(returnHref);
  });

  it("closes the embedded planner back to Work without changing the saved plan", () => {
    render(<TodayPlanner {...defaultProps} embedded returnHref="/admin/work" />);
    expect(screen.queryByRole("main")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close daily planning" }));
    expect(push).toHaveBeenCalledWith("/admin/work");
    expect(upsertDayPlan).not.toHaveBeenCalled();
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
    pickMainTask();
    next();
    fireEvent.click(screen.getByRole("button", { name: /Read/ }));
    next();

    const rail = screen.getByText("Rides along").parentElement as HTMLElement;
    expect(rail.textContent).toContain("Read");
    expect(rail.textContent).toContain("Reserves no time");
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

  it("opens on the timeline when the route asks for it", () => {
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    // No mood, no intention, no outcome step on the way.
    expect(screen.getByRole("heading", { name: "Your plan for today" })).toBeTruthy();
    expect(screen.getByLabelText("Write launch brief, 08:00 to 09:00")).toBeTruthy();
  });

  it("edits an existing plan in place: save state, no steps, ritual one link away", async () => {
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    expect(screen.queryByText(/Step \d of/)).toBeNull();
    expect(screen.getByText("All changes saved")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /start the full daily ritual/i }).getAttribute("href")
    ).toBe("?step=ritual");
    expect(
      (screen.getByRole("button", { name: "Saved" }) as HTMLButtonElement).disabled
    ).toBe(true);

    // A keyboard nudge is a real change: the state says so and Save wakes up.
    fireEvent.keyDown(screen.getByLabelText("Write launch brief, 08:00 to 09:00"), {
      key: "ArrowDown",
    });
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    expect(upsertDayPlan.mock.calls[0][2].blocks[0]).toMatchObject({
      start_time: "08:05",
      end_time: "09:05",
    });
    await waitFor(() => expect(screen.getByText(/Saved at/)).toBeTruthy());
  });

  it("keeps edits on screen and says so when saving fails", async () => {
    upsertDayPlan.mockRejectedValueOnce(new Error("offline"));
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    fireEvent.keyDown(screen.getByLabelText("Write launch brief, 08:00 to 09:00"), {
      key: "ArrowDown",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(screen.getByText(/Not saved\./)).toBeTruthy());
    expect(screen.getByText("Not saved")).toBeTruthy();
    expect(screen.getByLabelText("Write launch brief, 08:05 to 09:05")).toBeTruthy();
  });

  it("explains an invalid block time in words inside the block editor", () => {
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));
    fireEvent.change(screen.getByLabelText("Block title"), { target: { value: "" } });

    expect(screen.getByText("Give this block a title.")).toBeTruthy();
  });

  it("still starts at the beginning without that request", () => {
    render(<TodayPlanner {...timelineProps} />);

    expect(
      screen.getByRole("heading", { name: "How are you feeling right now?" })
    ).toBeTruthy();
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

describe("journalAnchorTitles", () => {
  it("tells copies with the same name apart and leaves unique names alone", () => {
    const titles = journalAnchorTitles([
      { id: "sys", name: "Weekly Review", isSystem: true },
      { id: "own", name: "Weekly Review", isSystem: false },
      { id: "solo", name: "Morning pages", isSystem: false },
    ]);
    expect(titles.get("sys")).toBe("Weekly Review (standard)");
    expect(titles.get("own")).toBe("Weekly Review (your copy)");
    expect(titles.get("solo")).toBe("Morning pages");
  });
});

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
import { useUserStore } from "@/lib/stores/user-store";
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

const recordStreakDay = vi.fn();
vi.mock("@/lib/streak-day", () => ({
  recordStreakDay: (...args: unknown[]) => recordStreakDay(...args),
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
  upsertDayPlan.mockResolvedValue({ id: "plan-1" });
  recordStreakDay.mockResolvedValue({ streak: 1, xpEarned: 0, totalXp: 0, celebration: null });
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

  /** Fills the required first gratitude line and moves on. */
  const writeGratitude = (text = "Morning coffee") => {
    fireEvent.change(screen.getByLabelText("I'm grateful for…"), {
      target: { value: text },
    });
    next();
  };

  /**
   * Clears the mood step and the gratitude step after it, neither of which
   * lets anyone through unanswered.
   */
  const pickMood = () => {
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    next();
    writeGratitude();
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
      screen.getByRole("heading", { name: "What are you grateful for?" })
    ).toBeTruthy();
  });

  it("asks for one thing to be grateful for before moving on, the other two optional", () => {
    render(<TodayPlanner {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    next();

    expect(screen.getByLabelText("I'm grateful for…")).toBeTruthy();
    expect(screen.getByLabelText(/I'm also grateful for…/)).toBeTruthy();
    expect(screen.getByLabelText(/And grateful for…/)).toBeTruthy();

    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "Write down one thing you are grateful for"
    );
    expect(
      screen.getByLabelText("I'm grateful for…").getAttribute("aria-invalid")
    ).toBe("true");

    // Spaces alone are not an answer.
    fireEvent.change(screen.getByLabelText("I'm grateful for…"), {
      target: { value: "   " },
    });
    next();
    expect(
      screen.getByRole("heading", { name: "What are you grateful for?" })
    ).toBeTruthy();

    writeGratitude("A quiet morning");
    expect(
      screen.getByRole("heading", { name: "What should guide today?" })
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

    expect(screen.queryByText("Why is that?")).toBeNull();
    expect(screen.queryByRole("button", { name: /adventure/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /good/i }));

    expect(screen.getByText("Why is that?")).toBeTruthy();
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
      screen.getByRole("heading", { name: "What are you grateful for?" })
    ).toBeTruthy();
  });

  it("commits the reasons, the written one and the gratitude with the plan", async () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    fireEvent.click(screen.getByRole("button", { name: /adventure/i }));
    fireEvent.change(screen.getByLabelText("Something else"), {
      target: { value: "First frost this morning" },
    });
    next();
    fireEvent.change(screen.getByLabelText(/And grateful for…/), {
      target: { value: "  Warm socks  " },
    });
    writeGratitude("Morning coffee");

    next();
    pickMainTask();
    next();
    fireEvent.click(
      screen.getByRole("button", { name: "Save plan" })
    );

    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    const notes = upsertDayPlan.mock.calls[0][2].notes as string;
    expect(notes).toContain("adventure");
    expect(notes).toContain("First frost this morning");
    // Filled lines only, trimmed: the empty middle line is not saved.
    expect(notes).toContain('"gratitude":["Morning coffee","Warm socks"]');
  });

  it("counts a saved plan as a streak day, once the plan is stored", async () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(recordStreakDay).toHaveBeenCalledTimes(1));
    expect(recordStreakDay.mock.calls[0][1]).toEqual({
      userId: "user-1",
      today: "2026-07-25",
      sourceId: "plan-1",
    });
    expect(upsertDayPlan.mock.invocationCallOrder[0]).toBeLessThan(
      recordStreakDay.mock.invocationCallOrder[0]
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("celebrates a streak the saved plan grew, and shows the new length at once", async () => {
    useUserStore.setState({ currentStreak: 4, bestStreak: 4, pendingStreak: null, totalXp: 100 });
    const celebration = { from: 4, to: 5, usedFreeze: false, bonusXp: 0 };
    recordStreakDay.mockResolvedValueOnce({ streak: 5, xpEarned: 0, totalXp: 100, celebration });
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(useUserStore.getState().pendingStreak).toEqual(celebration));
    expect(useUserStore.getState().currentStreak).toBe(5);
    expect(useUserStore.getState().totalXp).toBe(100);
  });

  it("does not celebrate a save on a day that already counted", async () => {
    useUserStore.setState({ currentStreak: 7, bestStreak: 7, pendingStreak: null, totalXp: 150 });
    recordStreakDay.mockResolvedValueOnce({ streak: 7, xpEarned: 0, totalXp: 150, celebration: null });
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(useUserStore.getState().pendingStreak).toBeNull();
    expect(useUserStore.getState().totalXp).toBe(150);
  });

  it("keeps the saved plan when the streak cannot be counted", async () => {
    recordStreakDay.mockRejectedValueOnce(new Error("offline"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText(/could not be saved/)).toBeNull();
    quiet.mockRestore();
  });

  it("asks mood and intention on their own steps", () => {
    render(<TodayPlanner {...defaultProps} />);

    // The intention field is not reachable until the mood step is done.
    expect(screen.queryByRole("textbox")).toBeNull();
    pickMood();
    expect(
      screen.getByRole("textbox", { name: "What should guide today?" })
    ).toBeTruthy();

    next();
    expect(
      screen.getByRole("heading", { name: "Set your priorities" })
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
      screen.getByRole("heading", { name: "Set your priorities" })
    ).toBeTruthy();

    next();
    expect(screen.getByRole("alert").textContent).toContain(
      "Choose your main focus"
    );
    expect(
      screen.getByRole("heading", { name: "Set your priorities" })
    ).toBeTruthy();

    pickMainTask();
    expect(screen.queryByRole("alert")).toBeNull();
    next();
    expect(
      screen.getByRole("heading", { name: "Schedule your day" })
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
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
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
    // It reopens on the step it was left on, the priorities.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Change your main focus: Write launch brief/ })
      ).toBeTruthy()
    );
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
    writeGratitude();
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
    next();

    expect(
      screen.getByLabelText(/Write launch brief, \d\d:\d\d to \d\d:\d\d/)
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Save plan" })
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
      screen.getByRole("textbox", { name: "What should guide today?" }),
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
    // A restored draft reopens on the step it was left on.
    await waitFor(() =>
      expect(screen.getByDisplayValue("Calm execution")).toBeTruthy()
    );
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
  }

  // --- "Add to your day" and the timeline step -----------------------------

  const dialog = () => screen.getByRole("dialog");

  const openAddDialog = () =>
    fireEvent.click(screen.getByRole("button", { name: "Add to your day" }));

  const submitAdd = () =>
    fireEvent.click(
      within(dialog()).getByRole("button", {
        name: /Add to your day|Update today's plan/,
      })
    );

  /** Adds a plain-text block through the dialog that is already open. */
  const addPlainInDialog = (title: string) => {
    fireEvent.change(within(dialog()).getByRole("combobox", { name: "Search your tasks" }), {
      target: { value: title },
    });
    fireEvent.click(within(dialog()).getByRole("option", { name: /without a task/ }));
    submitAdd();
  };

  const chooseKind = (kind: string) =>
    fireEvent.click(within(dialog()).getByRole("radio", { name: kind }));

  /** Reserves a block for the "Read" habit at `start`. */
  function reserveHabit(start: string) {
    openAddDialog();
    chooseKind("Habit");
    fireEvent.click(within(dialog()).getByRole("radio", { name: /^Read/ }));
    fireEvent.change(within(dialog()).getByLabelText("Starts"), {
      target: { value: start },
    });
    submitAdd();
  }

  it("walks five steps and saves the plan from the timeline", () => {
    render(<TodayPlanner {...defaultProps} />);

    expect(screen.getByText(/Step 1 of 5/)).toBeTruthy();
    pickMood();
    next();
    pickMainTask();
    next();

    expect(screen.getByText(/Step 5 of 5/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Schedule your day" })).toBeTruthy();
    expect(screen.queryByText("Add your daily anchors")).toBeNull();
    expect(screen.getByRole("button", { name: "Add to your day" })).toBeTruthy();
    // The timeline is the last step: no day hours to set, no review after it.
    expect(screen.queryByRole("button", { name: "Edit day hours" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save plan" })).toBeTruthy();
    expect(screen.queryByText(/scheduled/)).toBeNull();
    expect(screen.queryByText("Also today")).toBeNull();
    expect(screen.queryByText("Draft · not saved")).toBeNull();
  });

  it("goes back without losing the choice, and forward again without a second block", () => {
    render(<TodayPlanner {...defaultProps} />);
    pickMood();
    next();
    pickMainTask();
    next();
    reserveHabit("10:00");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("button", { name: /Change your main focus: Write launch brief/ })
    ).toBeTruthy();
    next();

    expect(screen.getAllByLabelText(/^Write launch brief, /)).toHaveLength(1);
    expect(screen.getAllByLabelText(/^Read, /)).toHaveLength(1);
  });

  it("follows a changed main focus with its block instead of keeping the old one", () => {
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
            estimateMinutes: 30,
          },
        ]}
      />
    );
    pickMood();
    next();
    pickMainTask();
    next();
    expect(screen.getByLabelText("Write launch brief, 08:00 to 09:00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: /Change your main focus/ }));
    fireEvent.click(screen.getByRole("option", { name: /Review pull request/ }));
    next();

    // Same slot, new task; the old task is not left behind on the day.
    expect(screen.queryByLabelText(/^Write launch brief, /)).toBeNull();
    expect(screen.getByLabelText("Review pull request, 08:00 to 09:00")).toBeTruthy();
  });

  it("reserves a habit once, however often it is confirmed, and always with a time", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    reserveHabit("10:00");
    expect(screen.getByLabelText("Read, 10:00 to 10:15")).toBeTruthy();

    // Planning the same habit again retimes its block instead of adding one.
    reserveHabit("10:30");
    expect(screen.getAllByLabelText(/^Read, /)).toHaveLength(1);
    expect(screen.getByLabelText("Read, 10:30 to 10:45")).toBeTruthy();

    // Nothing can be kept on the day without a time any more.
    fireEvent.click(screen.getByLabelText("Read, 10:30 to 10:45"));
    expect(screen.queryByRole("button", { name: "Keep flexible instead" })).toBeNull();
  });

  it("hides habits already done today until asked, and never marks one done", () => {
    render(
      <TodayPlanner
        {...timelineProps}
        habits={[
          { id: "habit-1", name: "Read", emoji: "📚", completedToday: true },
          { id: "habit-2", name: "Stretch", emoji: "🧘", completedToday: false },
        ]}
      />
    );
    gotoTimeline();
    openAddDialog();
    chooseKind("Habit");

    expect(within(dialog()).queryByRole("radio", { name: /^Read/ })).toBeNull();
    expect(within(dialog()).getByRole("radio", { name: /^Stretch/ })).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Show completed (1)" }));
    expect(
      within(dialog()).getByRole("radio", { name: /^Read.*Done today/ })
    ).toBeTruthy();
  });

  it("tells reflection templates with the same name apart", () => {
    render(
      <TodayPlanner
        {...timelineProps}
        journals={[
          { id: "sys", name: "Weekly Review", icon: "📓", completedToday: false, isSystem: true },
          { id: "own", name: "Weekly Review", icon: "📓", completedToday: false, isSystem: false },
        ]}
      />
    );
    gotoTimeline();
    openAddDialog();
    chooseKind("Reflection");

    expect(
      within(dialog()).getByRole("radio", { name: /Weekly Review \(standard\).*Built-in template/ })
    ).toBeTruthy();
    expect(
      within(dialog()).getByRole("radio", { name: /Weekly Review \(your copy\).*Your template/ })
    ).toBeTruthy();
  });

  it("asks for a choice before adding, and adds a task only once", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    openAddDialog();

    submitAdd();
    expect(within(dialog()).getByText("Choose a task, or type a title.")).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole("option", { name: /Write launch brief/ }));
    const button = within(dialog()).getByRole("button", { name: "Add to your day" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(screen.queryByRole("dialog")).toBeNull();
    // The priority block and the new one: the second confirm added nothing.
    expect(screen.getAllByLabelText(/^Write launch brief, /)).toHaveLength(2);
  });

  it("adds a break as a time block with its own name", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    openAddDialog();
    chooseKind("Break");
    fireEvent.change(within(dialog()).getByLabelText("Starts"), {
      target: { value: "10:00" },
    });
    submitAdd();

    expect(screen.getByLabelText("Break, 10:00 to 10:15")).toBeTruthy();
  });

  it("adds a general block that is only a time on the day, linked to nothing", async () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    openAddDialog();
    chooseKind("General");

    // A title is all it asks for, and it is required.
    submitAdd();
    expect(within(dialog()).getByText("Give the block a title.")).toBeTruthy();

    fireEvent.change(within(dialog()).getByLabelText("Title"), {
      target: { value: "Lunch with Sam" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Starts"), {
      target: { value: "12:00" },
    });
    submitAdd();

    expect(screen.getByLabelText("Lunch with Sam, 12:00 to 13:00")).toBeTruthy();
    expect(createTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(1));
    expect(
      upsertDayPlan.mock.calls[0][2].blocks.find(
        (block: { title: string }) => block.title === "Lunch with Sam"
      )
    ).toMatchObject({
      start_time: "12:00",
      end_time: "13:00",
      category: "other",
      source_type: "manual",
      source_id: null,
    });
    // Not a task, not a habit: nothing for the plan's anchors either.
    expect(upsertDayPlan.mock.calls[0][2].notes).not.toContain("Lunch with Sam");
  });

  it("explains a start that collides, at the field, and offers the next free time", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    openAddDialog();
    chooseKind("Break");
    fireEvent.change(within(dialog()).getByLabelText("Starts"), {
      target: { value: "09:30" },
    });

    expect(within(dialog()).getByText(/Overlaps “Side quest” \(09:15–10:00\)/)).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Start at 10:00 instead" }));
    expect(within(dialog()).getByLabelText("Starts")).toHaveProperty("value", "10:00");
  });

  it("shows the whole day from midnight, without day hours, a day-end reminder or a time summary", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    expect(screen.getByLabelText("Add something between 00:00 and 08:00")).toBeTruthy();
    expect(screen.getByLabelText("Add something between 11:45 and 23:59")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit day hours" })).toBeNull();
    expect(document.querySelector('[data-slot="shutdown-marker"]')).toBeNull();
    expect(screen.queryByText(/scheduled/)).toBeNull();
    expect(screen.queryByText(/unplanned/)).toBeNull();
    // Nothing is outside the day when the day is all 24 hours.
    expect(
      screen.getByLabelText("Training, 11:00 to 11:45").getAttribute("data-outside")
    ).not.toBe("true");
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
    // the whole point of the axis.
    expect(px(a, "height") / px(b, "height")).toBeCloseTo(60 / 45, 5);
    expect(px(b, "height")).toBeCloseTo(px(c, "height"), 5);

    // The day opens at midnight, so the first block sits eight hours down and
    // the others are offset by their real distance from it.
    expect(px(a, "top")).toBeCloseTo(8 * 60 * 1.2, 5);
    expect((px(b, "top") - px(a, "top")) / px(a, "height")).toBeCloseTo(75 / 60, 5);
    expect((px(c, "top") - px(a, "top")) / px(a, "height")).toBeCloseTo(180 / 60, 5);
  });

  it("opens the whole day by default and folds a long free stretch into one labelled row", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    // The day opens at scale: 11:45 to midnight is empty but still drawn, and
    // nothing is folded until someone asks for the compact view.
    expect(
      screen.getByLabelText("Add something between 11:45 and 23:59")
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /11:45–23:59 · 12h 15m free/ })
    ).toBeNull();

    // 11:45 to midnight is empty: one row says so instead of twelve hour lines.
    fireEvent.click(screen.getByRole("button", { name: "Compact view" }));
    const fold = screen.getByRole("button", { name: /11:45–23:59 · 12h 15m free/ });
    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByLabelText("Add something between 11:45 and 23:59")
    ).toBeNull();

    fireEvent.click(fold);
    expect(
      screen.getByLabelText("Add something between 11:45 and 23:59")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Compact view" }));
    expect(screen.getByRole("button", { name: /11:45–23:59 · 12h 15m free/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show full day" }));
    expect(
      screen.getByLabelText("Add something between 11:45 and 23:59")
    ).toBeTruthy();
  });

  it("keeps short free time at scale, labelled with its length", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    expect(
      screen.getByLabelText("Add something between 09:00 and 09:15")
    ).toBeTruthy();
    const hour = screen.getByLabelText("Add something between 10:00 and 11:00");
    expect(hour.textContent).toContain("1h free");
    expect(Number.parseFloat(hour.style.height)).toBeCloseTo(60 * 1.2, 5);
  });

  it("previews only the hour it would offer, where the pointer is", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const gap = screen.getByLabelText("Add something between 11:45 and 23:59");
    // jsdom reports a zero-origin rect, so clientY is the offset from the top
    // of the track: 924px at 1.2px per minute is 770 minutes past midnight,
    // which is 12:50.
    fireEvent.mouseMove(gap, { clientY: 924 });

    const shown = gap.querySelector('[data-slot="gap-preview"]') as HTMLElement;
    expect(shown.textContent).toContain("12:00");
    expect(shown.textContent).toContain("13:00");
    expect(Number.parseFloat(shown.style.height)).toBeCloseTo(60 * 1.2, 5);

    fireEvent.mouseLeave(gap);
    expect(gap.querySelector('[data-slot="gap-preview"]')).toBeNull();
  });

  it("opens Add to your day at the free time that was tapped, sized to fit", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Add something between 09:00 and 09:15"));
    expect(within(dialog()).getByLabelText("Starts")).toHaveProperty("value", "09:00");
    addPlainInDialog("Quick call");

    // A 15-minute gap gets a 15-minute block, and nothing after it moves.
    expect(screen.getByLabelText("Quick call, 09:00 to 09:15")).toBeTruthy();
    expect(screen.getByLabelText("Side quest, 09:15 to 10:00")).toBeTruthy();
    expect(screen.queryByText("Two blocks want the same minutes.")).toBeNull();
    expect(
      screen.queryByLabelText("Add something between 09:00 and 09:15")
    ).toBeNull();
  });

  it("starts from the top of a gap when it is reached by keyboard", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const gap = screen.getByLabelText("Add something between 10:00 and 11:00");
    fireEvent.focus(gap);
    expect(
      (gap.querySelector('[data-slot="gap-preview"]') as HTMLElement).textContent
    ).toContain("10:00");
    fireEvent.click(gap, { detail: 0 });
    expect(within(dialog()).getByLabelText("Starts")).toHaveProperty("value", "10:00");
  });

  it("draws a short block at its real height, clear of the next one", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    fireEvent.click(screen.getByLabelText("Add something between 09:00 and 09:15"));
    addPlainInDialog("Quick call");

    const px = (el: HTMLElement, prop: "height" | "top") =>
      Number.parseFloat(el.style[prop]);
    const short = screen.getByLabelText("Quick call, 09:00 to 09:15");
    const after = screen.getByLabelText("Side quest, 09:15 to 10:00");

    expect(px(short, "height")).toBeCloseTo(15 * 1.2, 5);
    expect(px(short, "top") + px(short, "height")).toBeLessThanOrEqual(
      px(after, "top")
    );
  });

  it("opens a block's exact times over the day and changes nothing until Apply", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));
    expect(dialog().textContent).toContain("Edit block");
    expect(within(dialog()).getByLabelText("Title")).toHaveProperty(
      "value",
      "Write launch brief"
    );
    expect(dialog().textContent).toContain("Main focus for today");

    fireEvent.change(within(dialog()).getByLabelText("Starts"), {
      target: { value: "08:30" },
    });
    // Still where it was: the edit waits for Apply.
    expect(screen.getByLabelText("Write launch brief, 08:00 to 09:00")).toBeTruthy();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Write launch brief, 08:00 to 09:00")).toBeTruthy();
  });

  it("names the later blocks a time change would move before moving them", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));
    fireEvent.change(within(dialog()).getByLabelText("Starts"), {
      target: { value: "08:30" },
    });

    const ripple = within(dialog()).getByRole("group", {
      name: "This change moves 2 later blocks",
    });
    expect(ripple.textContent).toContain("Side quest → 09:45 (+30m)");
    expect(ripple.textContent).toContain("Training → 11:30 (+30m)");

    fireEvent.click(within(dialog()).getByRole("button", { name: "Apply" }));
    expect(screen.getByLabelText("Write launch brief, 08:30 to 09:30")).toBeTruthy();
    expect(screen.getByLabelText("Side quest, 09:45 to 10:30")).toBeTruthy();
    expect(screen.getByLabelText("Training, 11:30 to 12:15")).toBeTruthy();
  });

  it("can leave the later blocks where they are, and then flags the overlap at the field", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));
    fireEvent.change(within(dialog()).getByLabelText("Ends"), {
      target: { value: "09:30" },
    });
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Keep them where they are" }));
    expect(
      within(dialog()).getByText(/Overlaps “Side quest” \(09:15–10:00\)/)
    ).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Apply" }));

    expect(screen.getByLabelText("Write launch brief, 08:00 to 09:30")).toBeTruthy();
    expect(screen.getByLabelText("Side quest, 09:15 to 10:00")).toBeTruthy();
    expect(screen.getByText("Two blocks want the same minutes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Space them out" }));
    expect(screen.queryByText("Two blocks want the same minutes.")).toBeNull();
  });

  it("explains invalid times in words and will not apply them", () => {
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    fireEvent.click(screen.getByLabelText("Write launch brief, 08:00 to 09:00"));
    fireEvent.change(within(dialog()).getByLabelText("Title"), { target: { value: "" } });
    expect(within(dialog()).getByText("Give this block a title.")).toBeTruthy();

    fireEvent.change(within(dialog()).getByLabelText("Title"), {
      target: { value: "Write launch brief" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Ends"), { target: { value: "07:30" } });
    expect(
      within(dialog()).getByText("The end time has to be after the start time.")
    ).toBeTruthy();
    expect(
      (within(dialog()).getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("removes a block from the plan and says the task itself stays", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.click(screen.getByLabelText("Side quest, 09:15 to 10:00"));
    expect(dialog().textContent).toContain("Only today's plan changes.");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove from plan" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText(/^Side quest, /)).toBeNull();
  });

  it("does not open a block when it was dragged, and says what the drag carries along", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const block = screen.getByLabelText("Write launch brief, 08:00 to 09:00");
    // jsdom does not implement pointer capture; the handler only needs it not
    // to throw.
    block.setPointerCapture = () => {};

    fireEvent.pointerDown(block, { button: 0, pointerId: 1, clientY: 100 });
    fireEvent.pointerMove(block, { pointerId: 1, clientY: 136 });
    expect(screen.getByText(/Also moves 2 later blocks\./)).toBeTruthy();
    fireEvent.pointerUp(block, { pointerId: 1, clientY: 136 });
    fireEvent.click(block);

    // 36px is 30 minutes, so the block moved -- and a move is not a tap.
    expect(screen.getByLabelText("Write launch brief, 08:30 to 09:30")).toBeTruthy();
    expect(screen.getByLabelText("Side quest, 09:45 to 10:30")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on the timeline when the route asks for it", () => {
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    // No mood, no intention, no outcome step on the way.
    expect(screen.getByRole("heading", { name: "Your plan for today" })).toBeTruthy();
    expect(screen.getByLabelText("Write launch brief, 08:00 to 09:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add to your day" })).toBeTruthy();
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
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TodayPlanner {...timelineProps} startAt="timeline" />);

    fireEvent.keyDown(screen.getByLabelText("Write launch brief, 08:00 to 09:00"), {
      key: "ArrowDown",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));

    await waitFor(() => expect(screen.getByText(/Not saved\./)).toBeTruthy());
    expect(screen.getByText("Not saved")).toBeTruthy();
    expect(screen.getByLabelText("Write launch brief, 08:05 to 09:05")).toBeTruthy();
    // The draft survives too, so a reload does not lose the edit.
    expect(
      sessionStorage.getItem("lifequest:today-plan:user-1:2026-07-25")
    ).toContain("08:05");
    quiet.mockRestore();
  });

  it("sends the plan once when Save is tapped twice", async () => {
    let finish: (value: unknown) => void = () => {};
    upsertDayPlan.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve))
    );
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    const save = screen.getByRole("button", { name: "Save plan" });
    fireEvent.click(save);
    fireEvent.click(save);
    finish({});

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(upsertDayPlan).toHaveBeenCalledTimes(1);
  });

  it("keeps the whole plan when the final save fails, and saves it on retry", async () => {
    upsertDayPlan.mockRejectedValueOnce(new Error("offline"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    reserveHabit("12:00");

    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    await waitFor(() =>
      expect(screen.getByText(/could not be saved/)).toBeTruthy()
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Schedule your day" })).toBeTruthy();
    expect(
      sessionStorage.getItem("lifequest:today-plan:user-1:2026-07-25")
    ).toContain("habit-1");

    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(upsertDayPlan).toHaveBeenCalledTimes(2));
    expect(upsertDayPlan.mock.calls[1][2].notes).toContain("habit-1");
    quiet.mockRestore();
  });

  it("reopens a restored draft on the timeline, where it was left", async () => {
    const first = render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();
    reserveHabit("12:00");
    await waitFor(() =>
      expect(
        sessionStorage.getItem("lifequest:today-plan:user-1:2026-07-25")
      ).toContain('"step":"timeline"')
    );
    first.unmount();

    render(<TodayPlanner {...timelineProps} />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Schedule your day" })).toBeTruthy()
    );
    expect(screen.getByLabelText("Read, 12:00 to 12:15")).toBeTruthy();
  });

  it("brings a draft saved on the old anchors step back on the timeline", async () => {
    sessionStorage.setItem(
      "lifequest:today-plan:user-1:2026-07-25",
      JSON.stringify({
        metadata: {
          ...createDefaultTodayPlanMetadata(),
          mood: "good",
          gratitude: ["Tea"],
          outcomes: [
            {
              id: "main",
              role: "must_win",
              title: "Write launch brief",
              task_id: null,
              duration_minutes: 60,
            },
          ],
          anchors: [
            {
              id: "habit-habit-1",
              source_type: "habit",
              source_id: "habit-1",
              title: "Read",
              emoji: "📚",
              duration_minutes: 15,
            },
          ],
        },
        blocks: timelineProps.initialBlocks,
        // The old six-step index of "Anchors".
        step: 3,
      })
    );
    render(<TodayPlanner {...timelineProps} />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Schedule your day" })).toBeTruthy()
    );
    // The anchor it carried stays in the plan's metadata; the timeline only
    // draws what has a time.
    expect(screen.queryByLabelText(/^Read, /)).toBeNull();
  });

  it("never resumes a draft past a missing main focus", async () => {
    sessionStorage.setItem(
      "lifequest:today-plan:user-1:2026-07-25",
      JSON.stringify({
        metadata: { ...createDefaultTodayPlanMetadata(), mood: "good", gratitude: ["Tea"] },
        blocks: [],
        step: "review",
      })
    );
    render(<TodayPlanner {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Set your priorities" })).toBeTruthy()
    );
  });

  it("still starts at the beginning without that request", () => {
    render(<TodayPlanner {...timelineProps} />);

    expect(
      screen.getByRole("heading", { name: "How are you feeling right now?" })
    ).toBeTruthy();
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
    render(
      <TodayPlanner
        {...timelineProps}
        initialBlocks={[
          ...timelineProps.initialBlocks,
          {
            id: "broken",
            start_time: "13:00",
            end_time: "12:00",
            title: "Broken",
            category: "other" as const,
          },
        ]}
      />
    );
    gotoTimeline();

    fireEvent.click(screen.getByRole("button", { name: /Broken.*needs a valid time/ }));
    expect(
      within(dialog()).getByText("The end time has to be after the start time.")
    ).toBeTruthy();
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

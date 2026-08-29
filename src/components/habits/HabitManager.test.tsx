import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HabitManager } from "@/components/habits/HabitManager";
import type { Habit, HabitLog } from "@/lib/types";

const fetchHabits = vi.fn();
const setHabitLogCompletion = vi.fn();

vi.mock("@/lib/habits", async () => {
  const actual = await vi.importActual<typeof import("@/lib/habits")>("@/lib/habits");
  return {
    ...actual,
    fetchHabits: (...args: unknown[]) => fetchHabits(...args),
    setHabitLogCompletion: (...args: unknown[]) => setHabitLogCompletion(...args),
  };
});

let habitLogRows: HabitLog[] = [];

function habitLogsQuery() {
  const query = {
    select: () => query,
    eq: () => query,
    lte: () => query,
    order: () => Promise.resolve({ data: habitLogRows, error: null }),
  };
  return query;
}

const rpc = vi.fn();

function defaultRpcImplementation(name: string) {
  if (name === "check_in_habit_reward") {
    return Promise.resolve({
      data: [{ total_xp: 10, coins: 3, awarded: true }],
      error: null,
    });
  }
  if (name === "undo_habit_check_in_reward") {
    return Promise.resolve({
      data: [{ total_xp: 0, coins: 0, reversed: true }],
      error: null,
    });
  }
  throw new Error(`Unexpected rpc in test: ${name}`);
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== "habit_logs") {
        throw new Error(`Unexpected table in test: ${table}`);
      }
      return habitLogsQuery();
    },
    rpc: (...args: Parameters<typeof defaultRpcImplementation>) => rpc(...args),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit-1",
    user_id: "user-1",
    name: "Meditation",
    emoji: "🧘",
    color: "blue",
    skill_category: null,
    is_archived: false,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = "2026-08-09";

beforeEach(() => {
  habitLogRows = [];
  fetchHabits.mockReset();
  setHabitLogCompletion.mockReset();
  rpc.mockReset();
  rpc.mockImplementation(defaultRpcImplementation);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HabitManager", () => {
  it("shows exactly one check-today action per habit, with no day-dot week strip", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    fetchHabits.mockResolvedValue([habitA]);

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    expect(
      screen.getByRole("button", { name: "Mark Meditation complete for 2026-08-09" })
    ).toBeTruthy();
    // No per-day dots: none of the week's other formatted-date labels should exist.
    expect(
      screen.queryByRole("button", {
        name: /Mark Meditation (complete|incomplete) for \w+, Aug/,
      })
    ).toBeNull();
  });

  it("checking a habit calls the save function for today, independently per habit", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    const habitB = habit({ id: "habit-b", name: "Journaling" });
    fetchHabits.mockResolvedValue([habitA, habitB]);
    setHabitLogCompletion.mockResolvedValue({
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: TODAY,
      completed: true,
      created_at: "2026-08-09T12:00:00.000Z",
    });

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    fireEvent.click(
      screen.getByRole("button", { name: "Mark Meditation complete for 2026-08-09" })
    );

    await waitFor(() =>
      expect(setHabitLogCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ habitId: "habit-a", date: TODAY, completed: true })
      )
    );

    // Journaling's own checkbox is untouched and independently actionable.
    expect(
      screen.getByRole("button", { name: "Mark Journaling complete for 2026-08-09" })
    ).toBeTruthy();
  });

  it("the icon chip always shows the habit's own emoji, never a checkmark override", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation", emoji: "🧘" });
    fetchHabits.mockResolvedValue([habitA]);
    habitLogRows = [
      {
        id: "log-1",
        user_id: "user-1",
        habit_id: "habit-a",
        entry_id: null,
        log_date: TODAY,
        completed: true,
        created_at: "2026-08-09T12:00:00.000Z",
      },
    ];

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    expect(screen.getByText("🧘")).toBeTruthy();
  });

  it("un-toggles a completed habit back to incomplete", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    fetchHabits.mockResolvedValue([habitA]);
    habitLogRows = [
      {
        id: "log-1",
        user_id: "user-1",
        habit_id: "habit-a",
        entry_id: null,
        log_date: TODAY,
        completed: true,
        created_at: "2026-08-09T12:00:00.000Z",
      },
    ];
    setHabitLogCompletion.mockResolvedValue({
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: TODAY,
      completed: false,
      created_at: "2026-08-09T12:00:00.000Z",
    });

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    const checkbox = screen.getByRole("button", {
      name: "Mark Meditation incomplete for 2026-08-09",
    });
    expect(checkbox.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(setHabitLogCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ habitId: "habit-a", date: TODAY, completed: false })
      )
    );
    await waitFor(() => expect(checkbox.getAttribute("aria-pressed")).toBe("false"));
  });

  it("keeps the saved checkbox state and shows no error banner when the reward RPC fails after the log save succeeds", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    fetchHabits.mockResolvedValue([habitA]);
    habitLogRows = [
      {
        id: "log-1",
        user_id: "user-1",
        habit_id: "habit-a",
        entry_id: null,
        log_date: TODAY,
        completed: true,
        created_at: "2026-08-09T12:00:00.000Z",
      },
    ];
    setHabitLogCompletion.mockResolvedValue({
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: TODAY,
      completed: false,
      created_at: "2026-08-09T12:00:00.000Z",
    });
    rpc.mockImplementation((name: string) => {
      if (name === "undo_habit_check_in_reward") {
        return Promise.reject(new Error("network blip"));
      }
      return defaultRpcImplementation(name);
    });

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    const checkbox = screen.getByRole("button", {
      name: "Mark Meditation incomplete for 2026-08-09",
    });
    expect(checkbox.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(setHabitLogCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ habitId: "habit-a", date: TODAY, completed: false })
      )
    );

    // The log write succeeded, so the checkbox reflects the saved (unchecked) state...
    await waitFor(() => expect(checkbox.getAttribute("aria-pressed")).toBe("false"));
    // ...and stays that way rather than being rolled back by the reward failure.
    expect(checkbox.getAttribute("aria-pressed")).toBe("false");

    // No "Could not update" error banner, since the log save itself succeeded.
    expect(screen.queryByRole("alert")).toBeNull();

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    consoleErrorSpy.mockRestore();
  });

  it("disables the checkbox while a save is pending", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    fetchHabits.mockResolvedValue([habitA]);
    let resolveSave: (log: HabitLog) => void = () => {};
    setHabitLogCompletion.mockImplementation(
      () => new Promise<HabitLog>((resolve) => { resolveSave = resolve; })
    );

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    const checkbox = screen.getByRole("button", {
      name: "Mark Meditation complete for 2026-08-09",
    });
    fireEvent.click(checkbox);

    await waitFor(() => expect(setHabitLogCompletion).toHaveBeenCalledTimes(1));
    expect(checkbox.hasAttribute("disabled")).toBe(true);

    resolveSave({
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: TODAY,
      completed: true,
      created_at: "2026-08-09T12:00:00.000Z",
    });
    await waitFor(() => expect(checkbox.hasAttribute("disabled")).toBe(false));
  });

  it("shows the full habit name as a tooltip when it is truncated in the list", async () => {
    const habitA = habit({
      id: "habit-a",
      name: "Enjoy five minutes of quiet before the day starts",
    });
    fetchHabits.mockResolvedValue([habitA]);

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);

    await waitFor(() =>
      expect(
        screen.getByTitle("Enjoy five minutes of quiet before the day starts")
      ).toBeTruthy()
    );
  });
});

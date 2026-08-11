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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== "habit_logs") {
        throw new Error(`Unexpected table in test: ${table}`);
      }
      return habitLogsQuery();
    },
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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HabitManager", () => {
  it("toggling a non-today day-dot marks only that day for that habit, without switching views or affecting other habits", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    const habitB = habit({ id: "habit-b", name: "Journaling" });
    fetchHabits.mockResolvedValue([habitA, habitB]);
    const savedLog: HabitLog = {
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: "2026-08-06",
      completed: true,
      created_at: "2026-08-06T12:00:00.000Z",
    };
    setHabitLogCompletion.mockResolvedValue(savedLog);

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);

    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    fireEvent.click(
      screen.getByRole("button", { name: /Mark Meditation (complete|incomplete) for \w+, Aug 6/ })
    );

    await waitFor(() =>
      expect(setHabitLogCompletion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          habitId: "habit-a",
          date: "2026-08-06",
          completed: true,
        })
      )
    );

    expect(
      screen.getByRole("tab", { name: "Today" }).getAttribute("aria-selected")
    ).toBe("true");
    expect(screen.queryByLabelText("History date")).toBeNull();
    // Verify icon button for today still exists
    expect(
      screen.getByRole("button", { name: "Mark Journaling complete for 2026-08-09" })
    ).toBeTruthy();
    // Verify today's day-dot still exists and is distinct (formatted date in aria-label)
    expect(
      screen.getByRole("button", { name: /Mark Journaling complete for Sunday, Aug 9/ })
    ).toBeTruthy();
  });

  it("a pending toggle for one date does not disable a different date's dot on the same habit", async () => {
    const habitA = habit({ id: "habit-a", name: "Meditation" });
    fetchHabits.mockResolvedValue([habitA]);
    let resolveSave: (log: HabitLog) => void = () => {};
    setHabitLogCompletion.mockImplementation(
      () => new Promise<HabitLog>((resolve) => { resolveSave = resolve; })
    );

    render(<HabitManager userId="user-1" timezone="UTC" today={TODAY} />);
    await waitFor(() => expect(screen.getByText("Meditation")).toBeTruthy());

    const mondayButton = screen.getByRole("button", {
      name: /Mark Meditation (complete|incomplete) for \w+, Aug 3/,
    });
    fireEvent.click(mondayButton);

    await waitFor(() => expect(setHabitLogCompletion).toHaveBeenCalledTimes(1));
    expect(mondayButton.hasAttribute("disabled")).toBe(true);

    const tuesdayButton = screen.getByRole("button", {
      name: /Mark Meditation (complete|incomplete) for \w+, Aug 4/,
    });
    expect(tuesdayButton.hasAttribute("disabled")).toBe(false);

    resolveSave({
      id: "log-1",
      user_id: "user-1",
      habit_id: "habit-a",
      entry_id: null,
      log_date: "2026-08-03",
      completed: true,
      created_at: "2026-08-03T12:00:00.000Z",
    });
    await waitFor(() => expect(mondayButton.hasAttribute("disabled")).toBe(false));
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

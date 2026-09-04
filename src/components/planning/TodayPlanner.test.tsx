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
  it("blocks progress until a Must Win is selected", () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("heading", { name: "Set up your Top Three for Today" })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Choose one Must Win"
    );
  });

  it("builds the timeline and performs one final write", async () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.focus(screen.getByLabelText("Must Win outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: /Read/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByDisplayValue("Write launch brief")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

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
    fireEvent.change(
      screen.getByLabelText("What quality should guide today?"),
      { target: { value: "Calm execution" } }
    );

    await waitFor(() =>
      expect(
        sessionStorage.getItem("lifequest:today-plan:user-1:2026-07-25")
      ).toContain("Calm execution")
    );
    first.unmount();

    render(<TodayPlanner {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByDisplayValue("Calm execution")).toBeTruthy()
    );
    expect(
      screen.getByText("Your unfinished plan was restored.")
    ).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  }

  it("names the ride-along habits without giving them a time slot", () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.focus(screen.getByLabelText("Must Win outcome"));
    fireEvent.click(screen.getByRole("option", { name: /Write launch brief/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: /Read/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const rail = screen.getByText("Rides along").parentElement as HTMLElement;
    expect(rail.textContent).toContain("Read");
    expect(rail.textContent).toContain("No time slot needed");
  });

  it("moves every later block when one is retimed", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.change(screen.getAllByLabelText("Start")[0], {
      target: { value: "08:30" },
    });

    const starts = screen.getAllByLabelText("Start");
    expect(starts[0]).toHaveProperty("value", "08:30");
    expect(starts[1]).toHaveProperty("value", "09:45");
    expect(starts[2]).toHaveProperty("value", "11:30");
  });

  it("offers to space out overlapping blocks instead of only refusing", () => {
    render(<TodayPlanner {...timelineProps} />);
    gotoTimeline();

    fireEvent.change(screen.getAllByLabelText("Start")[1], {
      target: { value: "08:30" },
    });
    expect(screen.getByText("Two blocks want the same minutes.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Space them out" }));

    expect(screen.queryByText("Two blocks want the same minutes.")).toBeNull();
    // The pushed block keeps its 45 minutes, it just starts after the first.
    const starts = screen.getAllByLabelText("Start");
    expect(starts[1]).toHaveProperty("value", "09:15");
    expect(screen.getAllByLabelText("End")[1]).toHaveProperty("value", "10:00");
  });
});

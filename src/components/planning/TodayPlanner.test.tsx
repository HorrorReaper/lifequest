import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPlanner } from "@/components/planning/TodayPlanner";

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
    expect(screen.getByRole("heading", { name: "Set your Top Three" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Choose one Must Win"
    );
  });

  it("builds the timeline and performs one final write", async () => {
    render(<TodayPlanner {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: /Write launch brief/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: /Read/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByDisplayValue("Write launch brief")).toBeTruthy();
    expect(screen.getByDisplayValue("📚 Read")).toBeTruthy();

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
});


import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HabitEditorDialog } from "@/components/habits/HabitEditorDialog";
import type { Habit } from "@/lib/types";

afterEach(cleanup);

describe("HabitEditorDialog", () => {
  it("creates a daily habit from the focused editor", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <HabitEditorDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Daily")).toBeTruthy();
    expect(screen.getByText("Habits currently repeat every day.")).toBeTruthy();

    const nameInput = screen.getByLabelText("Name");
    await user.type(nameInput, "Morning walk");
    await user.click(screen.getByRole("radio", { name: "Forest" }));
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morning walk",
      emoji: "✅",
      color: "green",
    });
  });

  it("prefills durable fields when editing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const habit: Habit = {
      id: "habit-1",
      user_id: "user-1",
      name: "Read",
      emoji: "📖",
      color: "purple",
      is_archived: false,
      sort_order: 0,
      created_at: "2026-07-01T12:00:00.000Z",
    };

    render(
      <HabitEditorDialog
        open
        habit={habit}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const nameInput = screen.getByLabelText("Name");
    expect((nameInput as HTMLInputElement).value).toBe("Read");
    expect(
      screen.getByRole("radio", { name: "Violet" }).getAttribute("aria-checked")
    ).toBe("true");

    await user.clear(nameInput);
    await user.type(nameInput, "Read ten pages");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Read ten pages",
      emoji: "📖",
      color: "purple",
    });
  });
});

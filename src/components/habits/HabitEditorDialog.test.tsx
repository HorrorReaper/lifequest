import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HabitEditorDialog } from "./HabitEditorDialog";

afterEach(cleanup);

describe("HabitEditorDialog skill picker", () => {
  it("asks only for a name when creating, with the details folded away", () => {
    render(
      <HabitEditorDialog open onOpenChange={() => undefined} onSubmit={() => undefined} />
    );

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByText("Daily habit")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /physical health/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /icon, color and skill/i }).getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("includes the chosen skill category in the submitted value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Morning run");
    await user.click(screen.getByRole("button", { name: /icon, color and skill/i }));
    await user.click(screen.getByRole("radio", { name: /physical health/i }));
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morning run",
      emoji: "🌱",
      color: "blue",
      skillCategory: "physical_health",
    });
  });

  it("defaults to no skill category when nothing is selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Read");
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ skillCategory: null })
    );
  });

  it("toggles a selected skill chip back off when tapped again", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByLabelText("Name"), "Meditate");
    await user.click(screen.getByRole("button", { name: /icon, color and skill/i }));
    const focusChip = screen.getByRole("radio", { name: /focus/i });
    await user.click(focusChip);
    await user.click(focusChip);
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ skillCategory: null })
    );
  });
});

describe("HabitEditorDialog edit actions", () => {
  const existing = {
    id: "habit-1",
    user_id: "user-1",
    name: "Meditation",
    emoji: "🧘",
    color: "blue",
    skill_category: null,
    is_archived: false,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  };

  it("offers stats and archiving for an existing habit", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    render(
      <HabitEditorDialog
        open
        habit={existing}
        onOpenChange={() => undefined}
        onSubmit={vi.fn()}
        onArchive={onArchive}
        detailsHref="/habits/habit-1"
      />
    );

    expect(screen.getByRole("link", { name: /details & stats/i }).getAttribute("href")).toBe("/habits/habit-1");
    await user.click(screen.getByRole("button", { name: /archive habit/i }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it("shows neither while creating a new habit", () => {
    render(
      <HabitEditorDialog
        open
        onOpenChange={() => undefined}
        onSubmit={vi.fn()}
        onArchive={vi.fn()}
        detailsHref="/habits/x"
      />
    );

    expect(screen.queryByRole("link", { name: /details & stats/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /archive habit/i })).toBeNull();
  });
});

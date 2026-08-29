import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HabitEditorDialog } from "./HabitEditorDialog";

afterEach(cleanup);

describe("HabitEditorDialog skill picker", () => {
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
    await user.click(screen.getByRole("radio", { name: /physical health/i }));
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morning run",
      emoji: "✅",
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
    const focusChip = screen.getByRole("radio", { name: /focus/i });
    await user.click(focusChip);
    await user.click(focusChip);
    await user.click(screen.getByRole("button", { name: /create habit/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ skillCategory: null })
    );
  });
});

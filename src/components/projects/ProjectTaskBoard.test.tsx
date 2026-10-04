import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/types";
import { ProjectTaskBoard } from "./ProjectTaskBoard";

afterEach(cleanup);
describe("project board card actions", () => {
  it("opens an explicit actions menu without starting deletion and provides keyboard status actions", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    const move = vi.fn();
    const edit = vi.fn();
    const task = {
      id: "one",
      title: "Ship project",
      status: "todo",
      priority: "medium",
      sort_order: 0,
      parent_task_id: null,
      due_date: null,
    } as Task;
    render(
      <ProjectTaskBoard
        tasks={[task]}
        busy={false}
        onDelete={remove}
        onDetach={vi.fn()}
        onMove={move}
        onEdit={edit}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ship project" }));
    expect(edit).toHaveBeenCalledWith(task);
    await user.click(
      screen.getByRole("button", { name: "Actions for Ship project" }),
    );
    expect(remove).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole("menuitem", { name: "Move to Done" }),
      ).toBeTruthy(),
    );
    await user.click(screen.getByRole("menuitem", { name: "Move to Done" }));
    expect(move).toHaveBeenCalledWith(task, "done", null);
  });
});

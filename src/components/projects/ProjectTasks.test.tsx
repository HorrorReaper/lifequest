import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task } from "@/lib/types";
import type {
  BoardSnapshot,
  WorkspaceProject,
} from "@/lib/projects/project-workspace";
import { ProjectTasks } from "./ProjectTasks";

vi.mock("./ProjectTaskBoard", () => ({
  ProjectTaskBoard: ({
    tasks,
    onMove,
    busy,
  }: {
    tasks: Task[];
    onMove: (task: Task, status: string, before: null) => void;
    busy: boolean;
  }) => (
    <button disabled={busy} onClick={() => onMove(tasks[0], "done", null)}>
      Move card
    </button>
  ),
}));
afterEach(cleanup);
describe("project board conflict handling", () => {
  it("rolls back failed optimistic moves and retains the conflict message after reloading", async () => {
    const user = userEvent.setup();
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "BOARD_CONFLICT" } });
    const board = {
      version: 4,
      tasks: [
        {
          id: "task",
          title: "Original",
          status: "todo",
          sort_order: 0,
          parent_task_id: null,
        } as Task,
      ],
    };
    const update = vi.fn();
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTasks
        client={{ rpc } as unknown as SupabaseClient}
        userId="owner"
        project={{ id: "project", name: "Project" } as WorkspaceProject}
        board={board}
        view="board"
        onView={vi.fn()}
        onBoard={update}
        reload={reload}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Move card" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "changed elsewhere",
      ),
    );
    expect(update.mock.calls[0][0].tasks[0].status).toBe("done");
    expect(update).toHaveBeenLastCalledWith(board);
    expect(reload).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "reorder_project_tasks",
      expect.objectContaining({ p_expected_version: 4 }),
    );
  });
  it("prevents duplicate writes while a move is pending", async () => {
    const user = userEvent.setup();
    let finish: (result: {
      data: BoardSnapshot;
      error: null;
    }) => void = () => {};
    const rpc = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const board = {
      version: 0,
      tasks: [
        {
          id: "task",
          title: "Original",
          status: "todo",
          sort_order: 0,
          parent_task_id: null,
        } as Task,
      ],
    };
    const reload = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectTasks
        client={{ rpc } as unknown as SupabaseClient}
        userId="owner"
        project={{ id: "project", name: "Project" } as WorkspaceProject}
        board={board}
        view="board"
        onView={vi.fn()}
        onBoard={vi.fn()}
        reload={reload}
      />,
    );
    await user.dblClick(screen.getByRole("button", { name: "Move card" }));
    expect(rpc).toHaveBeenCalledOnce();
    finish({ data: { ...board, version: 1 }, error: null });
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Move card" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(reload).toHaveBeenCalledOnce();
  });
});

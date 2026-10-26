import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskCombobox } from "./TaskCombobox";
import type { TodayPlannerTask } from "./TodayPlanner";

afterEach(() => {
  cleanup();
});

function task(overrides: Partial<TodayPlannerTask> = {}): TodayPlannerTask {
  return {
    id: "task-1",
    title: "Write launch brief",
    dueDate: null,
    priority: "medium",
    isOverdue: false,
    estimateMinutes: null,
    ...overrides,
  };
}

describe("TaskCombobox", () => {
  it("filters existing tasks as the query changes", () => {
    const tasks = [
      task({ id: "1", title: "Write launch brief" }),
      task({ id: "2", title: "Review pull request" }),
    ];
    render(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={tasks}
        linkedTaskId={null}
        value="review"
        onChangeText={vi.fn()}
        onSelectTask={vi.fn()}
        onCreateTask={vi.fn()}
      />
    );

    fireEvent.focus(screen.getByRole("combobox"));

    expect(screen.getByText("Review pull request")).toBeTruthy();
    expect(screen.queryByText("Write launch brief")).toBeNull();
  });

  it("selecting an existing task calls onSelectTask, not onCreateTask", () => {
    const onSelectTask = vi.fn();
    const onCreateTask = vi.fn();
    render(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={[task({ id: "1", title: "Write launch brief" })]}
        linkedTaskId={null}
        value="write"
        onChangeText={vi.fn()}
        onSelectTask={onSelectTask}
        onCreateTask={onCreateTask}
      />
    );

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Write launch brief"));

    expect(onSelectTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", title: "Write launch brief" })
    );
    expect(onCreateTask).not.toHaveBeenCalled();
  });

  it("offers to create a task only when no existing title matches exactly", () => {
    const tasks = [task({ id: "1", title: "Write launch brief" })];

    const { rerender } = render(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={tasks}
        linkedTaskId={null}
        value="Write launch brief"
        onChangeText={vi.fn()}
        onSelectTask={vi.fn()}
        onCreateTask={vi.fn()}
      />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.queryByText(/^Create/)).toBeNull();

    rerender(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={tasks}
        linkedTaskId={null}
        value="Ship the release notes"
        onChangeText={vi.fn()}
        onSelectTask={vi.fn()}
        onCreateTask={vi.fn()}
      />
    );
    expect(screen.getByText(/^Create .Ship the release notes./)).toBeTruthy();
  });

  it("creating a task passes the trimmed query and closes the dropdown", () => {
    const onCreateTask = vi.fn();
    render(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={[]}
        linkedTaskId={null}
        value="  Plan the offsite  "
        onChangeText={vi.fn()}
        onSelectTask={vi.fn()}
        onCreateTask={onCreateTask}
      />
    );

    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText(/^Create .Plan the offsite./));

    expect(onCreateTask).toHaveBeenCalledWith("Plan the offsite");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports selecting the highlighted option with the keyboard", () => {
    const onSelectTask = vi.fn();
    render(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={[
          task({ id: "1", title: "Write launch brief" }),
          task({ id: "2", title: "Write onboarding doc" }),
        ]}
        linkedTaskId={null}
        value="write"
        onChangeText={vi.fn()}
        onSelectTask={onSelectTask}
        onCreateTask={vi.fn()}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelectTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "2", title: "Write onboarding doc" })
    );
  });

  it("shows a checkmark next to the task currently linked to this outcome", () => {
    render(
      <TaskCombobox
        ariaLabel="Must Win outcome"
        tasks={[task({ id: "1", title: "Write launch brief" })]}
        linkedTaskId="1"
        value="write"
        onChangeText={vi.fn()}
        onSelectTask={vi.fn()}
        onCreateTask={vi.fn()}
      />
    );

    fireEvent.focus(screen.getByRole("combobox"));

    const option = screen.getByRole("option", { name: /Write launch brief/ });
    expect(option.querySelector("svg")).toBeTruthy();
  });

  describe("inline, inside a picker dialog", () => {
    it("lists every task without waiting for focus, with when each is due", () => {
      const tasks = Array.from({ length: 9 }, (_, index) =>
        task({ id: String(index), title: `Task ${index}` })
      );
      tasks[0] = task({
        id: "0",
        title: "Task 0",
        dueDate: "2026-07-24",
        isOverdue: true,
        estimateMinutes: 45,
      });
      render(
        <TaskCombobox
          inline
          today="2026-07-25"
          ariaLabel="Search your tasks"
          tasks={tasks}
          linkedTaskId={null}
          value=""
          onChangeText={vi.fn()}
          onSelectTask={vi.fn()}
          onCreateTask={vi.fn()}
        />
      );

      // Past the popup's cap of six: the dialog scrolls instead.
      expect(screen.getAllByRole("option")).toHaveLength(9);
      expect(
        screen.getByRole("option", { name: /Task 0.*Overdue since Jul 24 · 45m/ })
      ).toBeTruthy();
    });

    it("offers a new title as a task or as plain text for today", () => {
      const onCreateTask = vi.fn();
      const onUseText = vi.fn();
      render(
        <TaskCombobox
          inline
          ariaLabel="Search your tasks"
          tasks={[task()]}
          linkedTaskId={null}
          value="Go for a walk"
          onChangeText={vi.fn()}
          onSelectTask={vi.fn()}
          onCreateTask={onCreateTask}
          onUseText={onUseText}
        />
      );

      const input = screen.getByRole("combobox");
      // Arrowing down past the create row reaches the plain-text one.
      fireEvent.keyDown(input, { key: "ArrowDown" });
      expect(input.getAttribute("aria-activedescendant")).toBe(
        screen.getByRole("option", { name: /without a task/ }).id
      );
      fireEvent.keyDown(input, { key: "Enter" });

      expect(onUseText).toHaveBeenCalledWith("Go for a walk");
      expect(onCreateTask).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("option", { name: /Create task “Go for a walk”/ }));
      expect(onCreateTask).toHaveBeenCalledWith("Go for a walk");
    });

    it("leaves Escape to the dialog around it", () => {
      render(
        <TaskCombobox
          inline
          ariaLabel="Search your tasks"
          tasks={[task()]}
          linkedTaskId={null}
          value=""
          onChangeText={vi.fn()}
          onSelectTask={vi.fn()}
          onCreateTask={vi.fn()}
        />
      );

      fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
      expect(screen.getByRole("option", { name: /Write launch brief/ })).toBeTruthy();
    });
  });
});

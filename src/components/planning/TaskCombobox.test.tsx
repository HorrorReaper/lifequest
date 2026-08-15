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
});

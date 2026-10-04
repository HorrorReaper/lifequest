import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/types";
import {
  boardOrder,
  moveBoardTask,
  normalizeLinkUrl,
} from "./project-workspace";

const task = (
  id: string,
  status = "todo",
  sort_order = 0,
  parent_task_id: string | null = null,
) => ({ id, status, sort_order, parent_task_id }) as Task;
describe("project board ordering", () => {
  it("moves between columns and compacts both orders without losing children or cancelled tasks", () => {
    const tasks = [
      task("a"),
      task("b", "todo", 1),
      task("c", "in_progress"),
      task("child", "todo", 0, "a"),
      task("cancelled", "cancelled"),
    ];
    const moved = moveBoardTask(tasks, "a", "in_progress", "c");
    expect(boardOrder(moved)).toEqual(
      expect.arrayContaining([
        { id: "a", status: "in_progress", sort_order: 0 },
        { id: "c", status: "in_progress", sort_order: 1 },
        { id: "b", status: "todo", sort_order: 0 },
      ]),
    );
    expect(moved.find((task) => task.id === "child")).toEqual(tasks[3]);
    expect(moved.find((task) => task.id === "cancelled")).toEqual(tasks[4]);
  });
  it("supports empty targets, upward moves and moving to the end", () => {
    const tasks = [task("a"), task("b", "todo", 1), task("c", "todo", 2)];
    expect(
      moveBoardTask(tasks, "c", "todo", "a")
        .filter((task) => !task.parent_task_id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((task) => task.id),
    ).toEqual(["c", "a", "b"]);
    expect(
      moveBoardTask(tasks, "a", "todo", null)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((task) => task.id),
    ).toEqual(["b", "c", "a"]);
    expect(
      moveBoardTask(tasks, "b", "done", null).find((task) => task.id === "b"),
    ).toMatchObject({ status: "done", sort_order: 0 });
  });
  it("normalizes legacy duplicate and gapped positions before persisting", () => {
    expect(
      boardOrder([task("b"), task("a"), task("c", "blocked", 99)]),
    ).toEqual([
      { id: "a", status: "todo", sort_order: 0 },
      { id: "b", status: "todo", sort_order: 1 },
      { id: "c", status: "blocked", sort_order: 0 },
    ]);
  });
  it("ignores dragging a child, an unknown card, or a cancelled target", () => {
    const tasks = [task("a"), task("child", "todo", 0, "a")];
    expect(moveBoardTask(tasks, "child", "done", null)).toBe(tasks);
    expect(moveBoardTask(tasks, "unknown", "todo", null)).toBe(tasks);
    expect(moveBoardTask(tasks, "a", "cancelled", null)).toBe(tasks);
  });
});
describe("project link addresses", () => {
  it("normalizes safe HTTP and HTTPS URLs", () => {
    expect(normalizeLinkUrl(" https://example.com/docs ")).toBe(
      "https://example.com/docs",
    );
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///secret",
    "https://user:password@example.com",
    "not a URL",
  ])("rejects %s", (value) => {
    expect(() => normalizeLinkUrl(value)).toThrow();
  });
});

import type { ProjectRow, ProjectStatus } from "@/lib/supabase/database.types";
import type { Task, TaskStatus } from "@/lib/types";

export type ProjectArea = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};
export type ProjectLink = {
  id: string;
  user_id: string;
  project_id: string;
  title: string;
  url: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type WorkspaceProject = ProjectRow & {
  area_id: string | null;
  status_before_archive: ProjectStatus | null;
  board_version: number;
};
export type ProjectSummary = WorkspaceProject & {
  task_total: number;
  task_completed: number;
};
export type BoardSnapshot = { version: number; tasks: Task[] };
export type ProjectDraft = Pick<
  WorkspaceProject,
  | "name"
  | "outcome"
  | "description"
  | "status"
  | "priority"
  | "health"
  | "start_date"
  | "target_date"
  | "color"
  | "area_id"
>;
export const PROJECT_STATUSES: ProjectStatus[] = [
  "idea",
  "planned",
  "active",
  "paused",
  "completed",
  "archived",
];
export const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];
export function newProjectDraft(): ProjectDraft {
  return {
    name: "",
    outcome: "",
    description: "",
    status: "planned",
    priority: "medium",
    health: "unset",
    start_date: null,
    target_date: null,
    color: "#7c3aed",
    area_id: null,
  };
}
export function projectDraft(project: WorkspaceProject): ProjectDraft {
  const {
    name,
    outcome,
    description,
    status,
    priority,
    health,
    start_date,
    target_date,
    color,
    area_id,
  } = project;
  return {
    name,
    outcome,
    description,
    status,
    priority,
    health,
    start_date,
    target_date,
    color,
    area_id,
  };
}
export function normalizeLinkUrl(value: string): string {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an HTTP or HTTPS address without login details.");
  return url.href;
}
export function orderedRoots(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => !task.parent_task_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}
/** Apply a drop to a full, unfiltered board, including empty columns. */
export function moveBoardTask(
  tasks: Task[],
  taskId: string,
  status: TaskStatus,
  beforeId: string | null,
): Task[] {
  if (!TASK_COLUMNS.some((column) => column.status === status)) return tasks;
  const roots = orderedRoots(tasks).filter(
    (task) => task.status !== "cancelled",
  );
  const moving = roots.find((task) => task.id === taskId);
  if (!moving || beforeId === taskId) return tasks;
  const target = roots.filter(
    (task) => task.id !== taskId && task.status === status,
  );
  const index = beforeId
    ? target.findIndex((task) => task.id === beforeId)
    : target.length;
  target.splice(index < 0 ? target.length : index, 0, { ...moving, status });
  const patches = new Map(
    target.map((task, sort_order) => [task.id, { status, sort_order }]),
  );
  roots
    .filter(
      (task) =>
        task.id !== taskId &&
        task.status === moving.status &&
        !patches.has(task.id),
    )
    .forEach((task, sort_order) =>
      patches.set(task.id, { status: task.status, sort_order }),
    );
  return tasks.map((task) =>
    patches.has(task.id) ? { ...task, ...patches.get(task.id) } : task,
  );
}
export function boardOrder(tasks: Task[]) {
  const positions = new Map<TaskStatus, number>();
  return orderedRoots(tasks)
    .filter((task) => task.status !== "cancelled")
    .map(({ id, status }) => {
      const sort_order = positions.get(status) ?? 0;
      positions.set(status, sort_order + 1);
      return { id, status, sort_order };
    });
}

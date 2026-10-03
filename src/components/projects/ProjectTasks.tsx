"use client";

import { useCallback, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskStatus } from "@/lib/types";
import {
  TaskEditorDialog,
  type TaskEditorDraft,
} from "@/components/tasks/TaskEditorDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  boardOrder,
  moveBoardTask,
  orderedRoots,
  TASK_COLUMNS,
  type BoardSnapshot,
  type WorkspaceProject,
} from "@/lib/projects/project-workspace";
import { announceProjectChange, searchTerm } from "@/lib/projects/project-data";
import { ProjectTaskBoard } from "./ProjectTaskBoard";
import {
  ProjectPickerDialog,
  useProjectPickerLoader,
} from "./ProjectPickerDialog";
import { ProjectConfirmDialog } from "./WorkspaceFormDialog";

export function ProjectTasks({
  client,
  userId,
  project,
  board,
  view,
  onView,
  onBoard,
  reload,
}: {
  client: SupabaseClient;
  userId: string;
  project: WorkspaceProject;
  board: BoardSnapshot;
  view: string;
  onView: (view: string) => void;
  onBoard: (board: BoardSnapshot) => void;
  reload: () => Promise<void>;
}) {
  const [editor, setEditor] = useState<Task | "new" | null>(null);
  const [editorProject, setEditorProject] = useState({
    id: project.id,
    name: project.name,
  });
  const [picker, setPicker] = useState<"task" | "project" | null>(null);
  const [confirmation, setConfirmation] = useState<{
    task: Task;
    action: "delete" | "detach";
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cancelled, setCancelled] = useState(false);
  const lock = useRef(false);
  const projectLoader = useProjectPickerLoader(client, userId);
  const taskLoader = useCallback(
    async (search: string, page: number) => {
      let query = client
        .from("tasks")
        .select("id,title,project_id,updated_at", { count: "exact" })
        .eq("user_id", userId)
        .is("parent_task_id", null);
      const term = searchTerm(search);
      if (term) query = query.ilike("title", `%${term}%`);
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("id")
        .range(page * 50, page * 50 + 49);
      if (error) throw new Error(error.message);
      return {
        items: (data ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          description:
            task.project_id === project.id
              ? "Already in this project"
              : task.project_id
                ? "Assigned to another project — select to move it"
                : "No project",
          updated_at: task.updated_at,
        })),
        more: (page + 1) * 50 < (count ?? 0),
      };
    },
    [client, userId, project.id],
  );
  function edit(task: Task | "new") {
    setEditorProject({
      id: task === "new" ? project.id : (task.project_id ?? ""),
      name: project.name,
    });
    setEditorError(null);
    setEditor(task);
  }
  async function move(task: Task, status: TaskStatus, beforeId: string | null) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    const previous = board;
    const next = moveBoardTask(board.tasks, task.id, status, beforeId);
    onBoard({ ...board, tasks: next });
    try {
      const { data, error } = await client.rpc("reorder_project_tasks", {
        p_project_id: project.id,
        p_expected_version: board.version,
        p_order: boardOrder(next),
      });
      if (error) throw new Error(error.message);
      onBoard(data as BoardSnapshot);
      // Task writes also advance the project's timestamp used by its metadata editor.
      await reload();
      announceProjectChange();
    } catch (error) {
      onBoard(previous);
      const message =
        error instanceof Error ? error.message : "Could not move this task.";
      await reload();
      setError(
        message.includes("BOARD_CONFLICT")
          ? "The board changed elsewhere. The latest board has been loaded; try your move again."
          : `${message} Your move was not saved. Try again.`,
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  async function save(draft: TaskEditorDraft) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setEditorError(null);
    try {
      const { subtasks, ...fields } = draft;
      const { error } = await client.rpc("save_project_task", {
        p_task_id: editor === "new" ? null : editor?.id,
        p_draft: fields,
        p_subtasks: subtasks?.map((item, sort_order) => ({
          ...item,
          sort_order,
        })),
        p_expected_updated_at: editor === "new" ? null : editor?.updated_at,
      });
      if (error) throw new Error(error.message);
      setEditor(null);
      await reload();
      announceProjectChange();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save this task.";
      setEditorError(
        message.includes("TASK_CONFLICT")
          ? "This task changed elsewhere. Your draft is preserved. Close and reopen the task to load its latest version."
          : message,
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const roots = orderedRoots(board.tasks).filter(
    (task) =>
      (cancelled ? task.status === "cancelled" : task.status !== "cancelled") &&
      task.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={saving} onClick={() => edit("new")}>
          New task
        </Button>
        <Button
          disabled={saving}
          variant="outline"
          onClick={() => setPicker("task")}
        >
          Assign existing task
        </Button>
        <div className="ml-auto flex gap-1">
          <Button
            variant={view === "board" ? "default" : "outline"}
            onClick={() => onView("board")}
          >
            Board
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            onClick={() => onView("list")}
          >
            List
          </Button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {view === "board" ? (
        <ProjectTaskBoard
          tasks={board.tasks}
          busy={saving}
          onMove={(task, status, before) => void move(task, status, before)}
          onEdit={edit}
          onDetach={(task) => setConfirmation({ task, action: "detach" })}
          onDelete={(task) => setConfirmation({ task, action: "delete" })}
        />
      ) : (
        <>
          <div className="flex gap-3">
            <Input
              aria-label="Search project tasks"
              placeholder="Search tasks…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cancelled}
                onChange={(event) => setCancelled(event.target.checked)}
              />
              Cancelled
            </label>
          </div>
          <div className="space-y-2">
            {!roots.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No matching tasks.
              </p>
            )}
            {roots.map((task) => (
              <div
                key={task.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => edit(task)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block font-medium">{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.priority}
                    {task.due_date && ` · ${task.due_date}`}
                  </span>
                </button>
                {task.status !== "cancelled" ? (
                  <select
                    aria-label={`Status of ${task.title}`}
                    className="h-10 rounded-lg border bg-background px-2 text-sm"
                    disabled={saving}
                    value={task.status}
                    onChange={(event) =>
                      void move(task, event.target.value as TaskStatus, null)
                    }
                  >
                    {TASK_COLUMNS.map((column) => (
                      <option key={column.status} value={column.status}>
                        {column.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Button variant="outline" onClick={() => edit(task)}>
                    Reopen / edit
                  </Button>
                )}
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setConfirmation({ task, action: "detach" })}
                >
                  Remove
                </Button>
                <Button
                  variant="ghost"
                  disabled={saving}
                  onClick={() => setConfirmation({ task, action: "delete" })}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
      {editor && (
        <TaskEditorDialog
          key={editor === "new" ? "new" : editor.id}
          open
          task={editor === "new" ? null : editor}
          saving={saving}
          error={editorError}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
          onSubmit={save}
          projectContext={{
            projectId: editorProject.id || null,
            projectName: editorProject.name,
            status: editor === "new" ? "todo" : editor.status,
            estimateMinutes: editor === "new" ? null : editor.estimate_minutes,
            blockedReason: editor === "new" ? null : editor.blocked_reason,
            subtasks:
              editor === "new"
                ? []
                : board.tasks
                    .filter((task) => task.parent_task_id === editor.id)
                    .map(({ id, title, is_completed, sort_order }) => ({
                      id,
                      title,
                      is_completed,
                      sort_order,
                    })),
            onChooseProject: () => setPicker("project"),
          }}
        />
      )}
      {picker === "project" && (
        <ProjectPickerDialog
          title="Choose project"
          loadPage={projectLoader}
          onClose={() => setPicker(null)}
          onPick={async (item) =>
            setEditorProject({
              id: item.id,
              name: item.id ? item.title : "No project",
            })
          }
        />
      )}
      {picker === "task" && (
        <ProjectPickerDialog
          title="Assign an existing task"
          loadPage={taskLoader}
          onClose={() => setPicker(null)}
          onPick={async (item) => {
            const { data, error: readError } = await client
              .from("tasks")
              .select("updated_at,project_id")
              .eq("id", item.id)
              .eq("user_id", userId)
              .single();
            if (readError) throw new Error(readError.message);
            if (data.project_id === project.id) return;
            const { error } = await client.rpc("assign_project_task", {
              p_task_id: item.id,
              p_project_id: project.id,
              p_expected_updated_at: data.updated_at,
            });
            if (error) throw new Error(error.message);
            await reload();
            announceProjectChange();
          }}
        />
      )}
      {confirmation && (
        <ProjectConfirmDialog
          open
          title={
            confirmation.action === "delete"
              ? "Delete this task and its subtasks?"
              : "Remove this task from the project?"
          }
          description={
            confirmation.action === "delete"
              ? `“${confirmation.task.title}” will be permanently deleted.`
              : "The task and its subtasks stay in Tasks. Notes and Daily Planner references remain intact."
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            const { error } = await client.rpc(
              confirmation.action === "delete"
                ? "delete_project_task"
                : "assign_project_task",
              {
                p_task_id: confirmation.task.id,
                ...(confirmation.action === "detach"
                  ? { p_project_id: null }
                  : {}),
                p_expected_updated_at: confirmation.task.updated_at,
              },
            );
            if (error) throw new Error(error.message);
            await reload();
            announceProjectChange();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import type { TaskStatus } from "@/lib/types";
import { TASK_COLUMNS } from "@/lib/projects/project-workspace";
import { ProjectConfirmDialog } from "@/components/projects/WorkspaceFormDialog";
import { ChevronDown, Flag, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DueDateField } from "@/components/tasks/DueDateField";
import { localDateKey } from "@/lib/dates";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ManagedTask, TaskPriority } from "@/lib/tasks";

interface TaskEditorDialogProps {
  open: boolean;
  task: ManagedTask | null;
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: TaskEditorDraft) => Promise<void>;
  defaults?: Partial<TaskEditorDraft>;
  contactFields?: React.ReactNode;
  contactDirty?: boolean;
  /**
   * The user's current day as a date key, for the Today and Tomorrow
   * choices. Callers that know the profile timezone pass it; the device's
   * own day is the fallback.
   */
  today?: string;
  projectContext?: {
    projectId: string | null;
    projectName: string;
    status: TaskStatus;
    estimateMinutes: number | null;
    blockedReason: string | null;
    subtasks: TaskSubtaskDraft[];
    onChooseProject: () => void;
  };
}

export type TaskSubtaskDraft = {
  id: string | null;
  title: string;
  is_completed: boolean;
  sort_order: number;
};

export interface TaskEditorDraft {
  title: string;
  description: string;
  due_date: string | null;
  priority: TaskPriority;
  project_id?: string | null;
  status?: TaskStatus;
  estimate_minutes?: number | null;
  blocked_reason?: string | null;
  subtasks?: TaskSubtaskDraft[];
}

const priorities: Array<{
  value: TaskPriority;
  label: string;
  description: string;
  activeClass: string;
}> = [
  {
    value: "high",
    label: "High",
    description: "Needs attention first",
    activeClass:
      "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Normal priority",
    activeClass:
      "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    value: "low",
    label: "Low",
    description: "Can wait",
    activeClass:
      "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
];

function initialDraft(task: ManagedTask | null): TaskEditorDraft {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    due_date: task?.due_date ?? "",
    priority: task?.priority ?? "medium",
  };
}

export function TaskEditorDialog({
  open,
  task,
  saving,
  error,
  onOpenChange,
  onSubmit,
  projectContext,
  defaults,
  contactFields,
  contactDirty,
  today,
}: TaskEditorDialogProps) {
  const todayKey = today ?? localDateKey();
  const [draft, setDraft] = useState<TaskEditorDraft>(() => ({
    ...initialDraft(task),
    ...(!task ? defaults : {}),
    ...(projectContext
      ? {
          status: projectContext.status,
          estimate_minutes: projectContext.estimateMinutes,
          blocked_reason: projectContext.blockedReason,
          subtasks: projectContext.subtasks,
        }
      : {}),
  }));
  const [titleError, setTitleError] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);
  // Details start open only when there is something in them already, so a
  // new task is a title and a date, and editing one still shows its notes.
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(task?.description?.trim()) || Boolean(defaults?.description)
  );
  // Set synchronously on submit, so a second tap in the same frame -- before
  // the disabled button has re-rendered -- cannot send the task twice.
  const submittingRef = useRef(false);
  const originalProject = useRef(projectContext?.projectId);
  function close() {
    if (saving) return;
    const initial = {
      ...initialDraft(task),
      ...(!task ? defaults : {}),
      ...(projectContext
        ? {
            status: projectContext.status,
            estimate_minutes: projectContext.estimateMinutes,
            blocked_reason: projectContext.blockedReason,
            subtasks: projectContext.subtasks,
          }
        : {}),
    };
    if (
      JSON.stringify(draft) !== JSON.stringify(initial) ||
      contactDirty ||
      originalProject.current !== projectContext?.projectId
    )
      setDiscard(true);
    else onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setTitleError("Give this task a clear title.");
      return;
    }
    if (saving || submittingRef.current) return;

    setTitleError(null);
    submittingRef.current = true;
    try {
      await onSubmit({
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
        due_date: draft.due_date || null,
        ...(projectContext ? { project_id: projectContext.projectId } : {}),
      });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <DialogContent
          className="inset-x-0 top-0 left-0 flex h-[100svh] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[88svh] sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          showCloseButton={!saving}
        >
          <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ListTodo className="size-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-xl">
                  {task ? "Edit task" : "Create a task"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  A clear title is enough. Everything else is optional.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            id="task-editor-form"
            onSubmit={handleSubmit}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="space-y-6 px-5 py-6 pb-28 sm:px-6 sm:pb-6">
              <div className="space-y-2">
                <Label htmlFor="task-title">Task</Label>
                <Input
                  id="task-title"
                  value={draft.title}
                  onChange={(event) => {
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }));
                    if (titleError) setTitleError(null);
                  }}
                  placeholder="What needs to be done?"
                  autoFocus
                  disabled={saving}
                  aria-invalid={Boolean(titleError)}
                  aria-describedby={titleError ? "task-title-error" : undefined}
                  className="h-12 text-base"
                />
                {titleError && (
                  <p id="task-title-error" className="text-sm text-destructive">
                    {titleError}
                  </p>
                )}
              </div>

              <DueDateField
                value={draft.due_date || null}
                today={todayKey}
                onChange={(due_date) =>
                  setDraft((current) => ({
                    ...current,
                    due_date: due_date ?? "",
                  }))
                }
                disabled={saving}
              />

              <fieldset className="space-y-3">
                <legend className="flex items-center gap-2 text-sm font-medium">
                  <Flag className="size-4 text-muted-foreground" />
                  Priority
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {priorities.map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          priority: priority.value,
                        }))
                      }
                      disabled={saving}
                      aria-pressed={draft.priority === priority.value}
                      className={cn(
                        "min-h-14 rounded-xl border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                        draft.priority === priority.value &&
                          priority.activeClass,
                      )}
                    >
                      <span className="block text-sm font-semibold">
                        {priority.label}
                      </span>
                      <span className="mt-0.5 hidden text-xs opacity-75 sm:block">
                        {priority.description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-2xl border">
                <button
                  type="button"
                  aria-expanded={detailsOpen}
                  aria-controls="task-details"
                  onClick={() => setDetailsOpen((open) => !open)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span>
                    Details{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      detailsOpen && "rotate-180",
                    )}
                  />
                </button>
                {detailsOpen && (
                  <div id="task-details" className="border-t px-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="task-description">Description</Label>
                      <Textarea
                        id="task-description"
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Add context, a next step, or a definition of done…"
                        rows={4}
                        disabled={saving}
                        className="min-h-28 resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>

              {contactFields}
              {projectContext && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      disabled={saving}
                      onClick={projectContext.onChooseProject}
                    >
                      {projectContext.projectName || "No project"} · Change
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-status">Status</Label>
                    <select
                      id="task-status"
                      className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
                      disabled={saving}
                      value={draft.status}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          status: event.target.value as TaskStatus,
                        }))
                      }
                    >
                      {[
                        ...TASK_COLUMNS,
                        { status: "cancelled", label: "Cancelled" },
                      ].map((column) => (
                        <option key={column.status} value={column.status}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-estimate">Estimate (minutes)</Label>
                    <Input
                      id="task-estimate"
                      type="number"
                      min={1}
                      max={100000}
                      value={draft.estimate_minutes ?? ""}
                      disabled={saving}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          estimate_minutes: event.target.value
                            ? Number(event.target.value)
                            : null,
                        }))
                      }
                    />
                  </div>
                  {draft.status === "blocked" && (
                    <div className="space-y-2">
                      <Label htmlFor="task-blocked">
                        What is blocking this task?
                      </Label>
                      <Textarea
                        id="task-blocked"
                        value={draft.blocked_reason ?? ""}
                        maxLength={1000}
                        disabled={saving}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            blocked_reason: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm font-medium">
                      Subtasks
                    </legend>
                    {draft.subtasks?.map((subtask, index) => (
                      <div
                        key={subtask.id ?? `new-${index}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          aria-label={`Complete subtask ${index + 1}`}
                          type="checkbox"
                          checked={subtask.is_completed}
                          disabled={saving}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              subtasks: current.subtasks?.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      is_completed: event.target.checked,
                                    }
                                  : item,
                              ),
                            }))
                          }
                        />
                        <Input
                          aria-label={`Subtask ${index + 1}`}
                          required
                          maxLength={240}
                          value={subtask.title}
                          disabled={saving}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              subtasks: current.subtasks?.map((item, i) =>
                                i === index
                                  ? { ...item, title: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={saving}
                          aria-label={`Remove subtask ${index + 1}`}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              subtasks: current.subtasks?.filter(
                                (_, i) => i !== index,
                              ),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving || (draft.subtasks?.length ?? 0) >= 200}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          subtasks: [
                            ...(current.subtasks ?? []),
                            {
                              id: null,
                              title: "",
                              is_completed: false,
                              sort_order: current.subtasks?.length ?? 0,
                            },
                          ],
                        }))
                      }
                    >
                      Add subtask
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Completing subtasks does not automatically complete the
                      main task.
                    </p>
                  </fieldset>
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
            </div>
          </form>

          <DialogFooter className="fixed inset-x-0 bottom-0 z-10 mx-0 mb-0 rounded-none border-t bg-background/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:mb-0 sm:rounded-none sm:px-6 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              className="h-12 sm:h-10"
              onClick={close}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="task-editor-form"
              className="h-12 sm:h-10"
              disabled={saving || !draft.title.trim()}
            >
              {saving
                ? "Saving…"
                : error
                  ? "Retry save"
                  : task
                    ? "Save changes"
                    : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ProjectConfirmDialog
        open={discard}
        title={task ? "Discard unsaved task changes?" : "Discard this new task?"}
        description={
          task
            ? "The saved task will remain intact."
            : "It has not been saved yet."
        }
        onCancel={() => setDiscard(false)}
        onConfirm={async () => onOpenChange(false)}
      />
    </>
  );
}

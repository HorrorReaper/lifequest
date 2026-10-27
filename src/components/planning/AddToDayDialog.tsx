"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
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
import { PlanTimeField } from "@/components/planning/PlanTimeField";
import { TaskCombobox } from "@/components/planning/TaskCombobox";
import type {
  TodayPlannerHabit,
  TodayPlannerJournal,
  TodayPlannerTask,
} from "@/components/planning/TodayPlanner";
import type { DayPlanBlock } from "@/lib/types";
import {
  blockForAnchor,
  blocksOverlapping,
  describeTaskDue,
  firstFreeStart,
  formatPlanMinutes,
  minutesToTime,
  timeToMinutes,
  type TodayPlanAnchor,
} from "@/lib/today-plan";
import { cn } from "@/lib/utils";

export type AddKind = "task" | "habit" | "reflection" | "break" | "training";

/** How the dialog opens: what it starts on and what it has filled in. */
export interface AddRequest {
  kind?: AddKind;
  /** A start to begin from, such as the free time that was tapped. */
  startMinutes?: number;
  durationMinutes?: number;
  /**
   * The free time from `startMinutes` to the next block. Suggested lengths
   * are capped to it, so tapping a short gap offers something that fits.
   */
  roomMinutes?: number;
  /** A habit or reflection to start with, by anchor id. */
  anchorId?: string;
  mode?: PlanMode;
}

type PlanMode = "block" | "flexible";

export type AddEntry =
  | {
      kind: "task";
      /** The linked task, or null for a block planned as plain text. */
      task: TodayPlannerTask | null;
      title: string;
      startTime: string;
      endTime: string;
    }
  | { kind: "break"; title: string; startTime: string; endTime: string }
  | {
      kind: "anchor";
      anchor: TodayPlanAnchor;
      mode: "block";
      startTime: string;
      endTime: string;
    }
  | { kind: "anchor"; anchor: TodayPlanAnchor; mode: "flexible" };

interface AddToDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AddRequest;
  blocks: DayPlanBlock[];
  dayStart: string;
  dayEnd: string;
  today: string;
  tasks: TodayPlannerTask[];
  habits: TodayPlannerHabit[];
  journals: TodayPlannerJournal[];
  /** Every habit, reflection and training the day could hold. */
  anchorOptions: TodayPlanAnchor[];
  /** The ones already in today's plan. */
  plannedAnchors: TodayPlanAnchor[];
  creatingTask: boolean;
  createTaskError: string | null;
  /** Creates a task from a title; resolves null when that failed. */
  onCreateTask: (title: string) => Promise<TodayPlannerTask | null>;
  onSubmit: (entry: AddEntry) => void;
}

const DEFAULT_MINUTES: Record<AddKind, number> = {
  task: 60,
  habit: 15,
  reflection: 10,
  break: 15,
  training: 75,
};

const DURATION_CHOICES = [5, 10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

const KIND_LABELS: Record<AddKind, string> = {
  task: "Task",
  habit: "Habit",
  reflection: "Reflection",
  break: "Break",
  training: "Training",
};

/**
 * One way in for everything the day can hold: "Add to your day".
 *
 * Tasks, breaks and training become time blocks. Habits and reflections ask
 * first whether to reserve a time block or keep them flexible for today.
 * Planning is not doing: nothing here marks a habit done, and a done habit
 * is hidden until "Show completed" asks for it. Everything chosen keeps its
 * link to the real task, habit or template rather than copying a title.
 */
export function AddToDayDialog(props: AddToDayDialogProps) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-lg">
        {/* Mounted only while open, so each opening starts from the
            request rather than from the last visit. */}
        {open && <AddForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function AddForm({
  request,
  blocks,
  dayStart,
  dayEnd,
  today,
  tasks,
  habits,
  journals,
  anchorOptions,
  plannedAnchors,
  creatingTask,
  createTaskError,
  onCreateTask,
  onSubmit,
  onOpenChange,
}: AddToDayDialogProps) {
  const preselected = request.anchorId
    ? anchorOptions.find((anchor) => anchor.id === request.anchorId) ?? null
    : null;
  const initialKind: AddKind =
    request.kind ??
    (preselected?.source_type === "journal"
      ? "reflection"
      : preselected?.source_type === "habit"
        ? "habit"
        : "task");

  const [kind, setKind] = useState<AddKind>(initialKind);
  const [query, setQuery] = useState("");
  const [task, setTask] = useState<TodayPlannerTask | null>(null);
  const [plainTitle, setPlainTitle] = useState<string | null>(null);
  const [anchorId, setAnchorId] = useState<string | null>(
    preselected?.id ?? null
  );
  const [mode, setMode] = useState<PlanMode>(request.mode ?? "block");
  const [breakTitle, setBreakTitle] = useState("Break");
  const [showCompleted, setShowCompleted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const submitted = useRef(false);

  const suggestedLength = (length: number) =>
    request.roomMinutes !== undefined
      ? Math.max(5, Math.min(length, request.roomMinutes))
      : length;
  const [duration, setDuration] = useState(
    request.durationMinutes ?? suggestedLength(DEFAULT_MINUTES[initialKind])
  );
  const [durationTouched, setDurationTouched] = useState(
    request.durationMinutes !== undefined
  );
  const dayStartMinutes = timeToMinutes(dayStart);
  const suggestStart = (length: number) => {
    const from = Number.isFinite(dayStartMinutes) ? dayStartMinutes : 8 * 60;
    return minutesToTime(firstFreeStart(blocks, from, length) ?? from);
  };
  const [start, setStart] = useState(
    request.startMinutes !== undefined
      ? minutesToTime(request.startMinutes)
      : suggestStart(duration)
  );
  const [startTouched, setStartTouched] = useState(
    request.startMinutes !== undefined
  );

  function chooseKind(next: AddKind) {
    setKind(next);
    setAttempted(false);
    if (!durationTouched) setDuration(suggestedLength(DEFAULT_MINUTES[next]));
    if (!startTouched) setStart(suggestStart(DEFAULT_MINUTES[next]));
  }

  function chooseTask(next: TodayPlannerTask) {
    setTask(next);
    setPlainTitle(null);
    if (!durationTouched && next.estimateMinutes) {
      setDuration(suggestedLength(next.estimateMinutes));
    }
  }

  // The anchor being planned: a chosen habit or reflection, or training.
  const trainingAnchor = anchorOptions.find(
    (anchor) => anchor.source_type === "workout"
  );
  const anchor =
    kind === "training"
      ? trainingAnchor ?? null
      : kind === "habit" || kind === "reflection"
        ? anchorOptions.find((item) => item.id === anchorId) ?? null
        : null;
  const anchorPlanned = anchor
    ? plannedAnchors.some((item) => item.id === anchor.id)
    : false;
  const anchorBlock = anchor ? blockForAnchor(blocks, anchor) : undefined;

  const asks = kind === "habit" || kind === "reflection";
  const needsTime = !asks || mode === "block";

  const startMinutes = timeToMinutes(start);
  const endMinutes = startMinutes + duration;
  const startError = !needsTime
    ? null
    : !Number.isFinite(startMinutes)
      ? "Enter a start time."
      : endMinutes > 23 * 60 + 59
        ? "This would run past midnight. Choose an earlier start or a shorter length."
        : null;
  // Its own block is about to be retimed, so it is no conflict.
  const conflicts =
    needsTime && !startError
      ? blocksOverlapping(blocks, startMinutes, endMinutes, anchorBlock?.id)
      : [];
  const freeStart =
    conflicts.length > 0
      ? firstFreeStart(
          blocks.filter((block) => block.id !== anchorBlock?.id),
          startMinutes,
          duration
        )
      : null;
  const dayEndMinutes = timeToMinutes(dayEnd);
  const outsideDay =
    needsTime &&
    !startError &&
    (startMinutes < dayStartMinutes || endMinutes > dayEndMinutes);

  const taskTitle = task?.title ?? plainTitle;
  const selectionError = !attempted
    ? null
    : kind === "task" && !taskTitle
      ? "Choose a task, or type a title."
      : kind === "habit" && !anchor
        ? "Choose a habit."
        : kind === "reflection" && !anchor
          ? "Choose a reflection."
          : kind === "break" && !breakTitle.trim()
            ? "Give the break a name."
            : null;

  function submit() {
    if (submitted.current) return;
    setAttempted(true);
    if (needsTime && startError) return;
    const startTime = start;
    const endTime = minutesToTime(endMinutes);

    let entry: AddEntry | null = null;
    if (kind === "task" && taskTitle) {
      entry = { kind: "task", task, title: taskTitle, startTime, endTime };
    } else if (kind === "break" && breakTitle.trim()) {
      entry = { kind: "break", title: breakTitle.trim(), startTime, endTime };
    } else if (anchor) {
      entry =
        asks && mode === "flexible"
          ? { kind: "anchor", anchor, mode: "flexible" }
          : { kind: "anchor", anchor, mode: "block", startTime, endTime };
    }
    if (!entry) return;
    // Confirming twice must not plan the same thing twice.
    submitted.current = true;
    onSubmit(entry);
    onOpenChange(false);
  }

  // Tasks already on the timeline are not offered again.
  const plannedTaskIds = new Set(
    blocks
      .filter((block) => block.source_type === "task" && block.source_id)
      .map((block) => block.source_id as string)
  );
  const offeredTasks = tasks.filter((item) => !plannedTaskIds.has(item.id));

  const kinds: AddKind[] = trainingAnchor
    ? ["task", "habit", "reflection", "break", "training"]
    : ["task", "habit", "reflection", "break"];

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">Add to your day</DialogTitle>
        <DialogDescription>
          Give it a time, or keep a habit or reflection flexible.
        </DialogDescription>
      </DialogHeader>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">What to add</legend>
        <div className="flex flex-wrap gap-2">
          {kinds.map((item) => (
            <ChoicePill
              key={item}
              name="add-kind"
              checked={kind === item}
              onChange={() => chooseKind(item)}
            >
              {KIND_LABELS[item]}
            </ChoicePill>
          ))}
        </div>
      </fieldset>

      {kind === "task" && (
        <div className="space-y-2">
          {taskTitle ? (
            <div className="flex items-center gap-3 border-y py-3">
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium">{taskTitle}</p>
                <p className="text-sm text-muted-foreground">
                  {task
                    ? describeTaskDue(task.dueDate, today) ?? "No due date"
                    : "Not saved as a task"}
                  {task && " · its due date stays as it is"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setTask(null);
                  setPlainTitle(null);
                }}
                className="shrink-0 text-primary hover:text-primary"
              >
                Change
              </Button>
            </div>
          ) : (
            <>
              <TaskCombobox
                inline
                ariaLabel="Search your tasks"
                tasks={offeredTasks}
                today={today}
                linkedTaskId={null}
                value={query}
                onChangeText={setQuery}
                onSelectTask={chooseTask}
                onCreateTask={async (title) => {
                  const created = await onCreateTask(title);
                  if (created) chooseTask(created);
                }}
                onUseText={(title) => {
                  setTask(null);
                  setPlainTitle(title.trim());
                }}
                creating={creatingTask}
                placeholder="Search tasks, or type a new one"
              />
              {createTaskError && (
                <p role="alert" className="text-sm text-destructive">
                  {createTaskError}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {kind === "break" && (
        <div className="space-y-1.5">
          <label htmlFor="add-break-title" className="block text-sm font-medium">
            Name
          </label>
          <Input
            id="add-break-title"
            value={breakTitle}
            maxLength={160}
            onChange={(event) => setBreakTitle(event.target.value)}
            className="h-11 rounded-xl text-base sm:h-11 md:text-base"
          />
        </div>
      )}

      {(kind === "habit" || kind === "reflection") && (
        <AnchorChoices
          kind={kind}
          options={anchorOptions.filter(
            (item) =>
              item.source_type === (kind === "habit" ? "habit" : "journal")
          )}
          selectedId={anchorId}
          onSelect={(id) => {
            setAnchorId(id);
            const chosen = anchorOptions.find((item) => item.id === id);
            if (chosen && !durationTouched) {
              setDuration(suggestedLength(chosen.duration_minutes));
            }
            // A habit already in the plan opens on how it is planned now.
            const existing = chosen && blockForAnchor(blocks, chosen);
            if (existing) {
              setStart(existing.start_time);
              setStartTouched(true);
              setMode("block");
            } else if (
              chosen &&
              plannedAnchors.some((item) => item.id === chosen.id)
            ) {
              setMode("flexible");
            }
          }}
          isDone={(item) =>
            item.source_type === "habit"
              ? Boolean(habits.find((habit) => habit.id === item.source_id)?.completedToday)
              : Boolean(
                  journals.find((journal) => journal.id === item.source_id)
                    ?.completedToday
                )
          }
          describePlan={(item) => {
            const block = blockForAnchor(blocks, item);
            if (block) return `In today's plan · ${block.start_time}–${block.end_time}`;
            return plannedAnchors.some((planned) => planned.id === item.id)
              ? "In today's plan · no time reserved"
              : null;
          }}
          isSystem={(item) =>
            Boolean(journals.find((journal) => journal.id === item.source_id)?.isSystem)
          }
          showCompleted={showCompleted}
          onShowCompleted={setShowCompleted}
        />
      )}

      {asks && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Planning</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard
              name="add-mode"
              checked={mode === "block"}
              onChange={() => setMode("block")}
              title="Reserve a time block"
              detail="Pick a start time and a length."
            />
            <ChoiceCard
              name="add-mode"
              checked={mode === "flexible"}
              onChange={() => setMode("flexible")}
              title="Keep flexible"
              detail="On today's list, no time reserved."
            />
          </div>
        </fieldset>
      )}

      {needsTime && (
        <div className="grid grid-cols-2 gap-3">
          <PlanTimeField
            label="Starts"
            value={start}
            onChange={(value) => {
              setStart(value);
              setStartTouched(true);
            }}
            error={startError}
            hint={
              conflicts.length > 0 ? (
                <span className="text-amber-800 dark:text-amber-200">
                  Overlaps “{conflicts[0].title || "Untitled block"}” (
                  {conflicts[0].start_time}–{conflicts[0].end_time}).{" "}
                  {freeStart !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setStart(minutesToTime(freeStart));
                        setStartTouched(true);
                      }}
                      className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary underline underline-offset-4 sm:min-h-0"
                    >
                      Start at {minutesToTime(freeStart)} instead
                    </button>
                  )}
                </span>
              ) : outsideDay ? (
                `Outside your day hours (${dayStart}–${dayEnd}).`
              ) : (
                `Ends at ${minutesToTime(endMinutes)}`
              )
            }
          />
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="add-duration" className="block text-sm font-medium">
              Length
            </label>
            <select
              id="add-duration"
              value={duration}
              onChange={(event) => {
                setDuration(Number(event.target.value));
                setDurationTouched(true);
              }}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {Array.from(new Set([...DURATION_CHOICES, duration]))
                .sort((a, b) => a - b)
                .map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatPlanMinutes(minutes)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {selectionError && (
        <p role="alert" className="text-sm text-destructive">
          {selectionError}
        </p>
      )}

      <DialogFooter className="-mx-5 -mb-5 bg-transparent p-5 pt-4">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={creatingTask}>
          {anchorPlanned ? "Update today's plan" : "Add to your day"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AnchorChoices({
  kind,
  options,
  selectedId,
  onSelect,
  isDone,
  describePlan,
  isSystem,
  showCompleted,
  onShowCompleted,
}: {
  kind: "habit" | "reflection";
  options: TodayPlanAnchor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isDone: (anchor: TodayPlanAnchor) => boolean;
  describePlan: (anchor: TodayPlanAnchor) => string | null;
  isSystem: (anchor: TodayPlanAnchor) => boolean;
  showCompleted: boolean;
  onShowCompleted: (show: boolean) => void;
}) {
  const noun = kind === "habit" ? "habit" : "reflection";
  const doneCount = options.filter(isDone).length;
  // A done one stays visible while it is the one chosen, so preselecting it
  // from today's list does not make it vanish.
  const visible = options.filter(
    (item) => showCompleted || !isDone(item) || item.id === selectedId
  );

  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {kind === "habit"
          ? "No habits yet. Create one on the Habits page first."
          : "No reflection templates yet. Create one in the Journal first."}
      </p>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">
        {kind === "habit" ? "Habit" : "Reflection"}
      </legend>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every {noun} is already done today.
        </p>
      ) : (
        <div className="max-h-64 divide-y overflow-y-auto rounded-xl border">
          {visible.map((item) => {
            const plan = describePlan(item);
            const done = isDone(item);
            return (
              <label
                key={item.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 has-[:checked]:bg-primary/8 has-[:focus-visible]:outline-3 has-[:focus-visible]:-outline-offset-3 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="radio"
                  name={`add-${kind}`}
                  checked={selectedId === item.id}
                  onChange={() => onSelect(item.id)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span aria-hidden="true" className="w-6 shrink-0 text-center text-lg">
                  {item.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {[
                      kind === "reflection"
                        ? isSystem(item)
                          ? "Built-in template"
                          : "Your template"
                        : null,
                      `${formatPlanMinutes(item.duration_minutes)} suggested`,
                      done ? "Done today" : null,
                      plan,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
      {doneCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          aria-pressed={showCompleted}
          onClick={() => onShowCompleted(!showCompleted)}
          className="mt-1 -ml-2 text-muted-foreground"
        >
          {showCompleted ? "Hide completed" : `Show completed (${doneCount})`}
        </Button>
      )}
    </fieldset>
  );
}

/** A radio drawn as a pill, for short choices that sit in one row. */
function ChoicePill({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-background hover:bg-muted"
        )}
      >
        {checked && <Check aria-hidden="true" className="size-4" />}
        {children}
      </span>
    </label>
  );
}

/** A radio with a title and one line of explanation. */
function ChoiceCard({
  name,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        checked ? "border-primary bg-primary/8" : "hover:bg-muted/60"
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

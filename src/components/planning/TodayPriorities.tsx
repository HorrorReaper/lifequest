"use client";

import { useRef, useState } from "react";
import { ChevronRight, Leaf, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityPickerDialog } from "@/components/planning/PriorityPickerDialog";
import type { TodayPlannerTask } from "@/components/planning/TodayPlanner";
import {
  describeTaskDue,
  formatPlanMinutes,
  type TodayPlanOutcome,
} from "@/lib/today-plan";
import type { DayPlanOutcomeRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TodayPrioritiesProps {
  outcomes: TodayPlanOutcome[];
  tasks: TodayPlannerTask[];
  /** The day being planned, as a date key; due dates are described against it. */
  today: string;
  /** Set while "Next" was refused for want of a main focus. */
  mainMissing: boolean;
  creatingRole: DayPlanOutcomeRole | null;
  createError: { role: DayPlanOutcomeRole; message: string } | null;
  onSelectTask: (role: DayPlanOutcomeRole, task: TodayPlannerTask) => void;
  onCreateTask: (role: DayPlanOutcomeRole, title: string) => Promise<boolean>;
  onUseText: (role: DayPlanOutcomeRole, title: string) => void;
  onDurationChange: (role: DayPlanOutcomeRole, minutes: number) => void;
  onRemove: (role: DayPlanOutcomeRole) => void;
}

const SLOT_NAMES: Record<DayPlanOutcomeRole, string> = {
  must_win: "main focus",
  progress: "second task",
  health: "recharge moment",
};

/**
 * The priorities step: one main focus, an optional second task, and a
 * separate moment to recharge.
 *
 * Three equal cards used to make this read like a form with three fields.
 * The main focus now carries the weight, the second task sits under a hair
 * line with less of it, and recovery is its own quiet row rather than a
 * third priority. Every choice happens in PriorityPickerDialog; this only
 * shows what is chosen.
 */
export function TodayPriorities({
  outcomes,
  tasks,
  today,
  mainMissing,
  creatingRole,
  createError,
  onSelectTask,
  onCreateTask,
  onUseText,
  onDurationChange,
  onRemove,
}: TodayPrioritiesProps) {
  const [pickerRole, setPickerRole] = useState<DayPlanOutcomeRole | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const rowRefs = useRef<Record<DayPlanOutcomeRole, HTMLButtonElement | null>>({
    must_win: null,
    progress: null,
    health: null,
  });
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const outcomeFor = (role: DayPlanOutcomeRole) => {
    const outcome = outcomes.find((item) => item.role === role) ?? null;
    return outcome?.title.trim() ? outcome : null;
  };
  const main = outcomeFor("must_win");
  const second = outcomeFor("progress");
  const recharge = outcomeFor("health");

  function openPicker(role: DayPlanOutcomeRole) {
    returnFocusRef.current = rowRefs.current[role];
    setPickerRole(role);
    setPickerOpen(true);
  }

  function closeWith(message: string) {
    setPickerOpen(false);
    setAnnouncement(message);
  }

  function remove(role: DayPlanOutcomeRole) {
    onRemove(role);
    setPickerOpen(false);
    setAnnouncement(`Removed your ${SLOT_NAMES[role]}.`);
    // The remove button goes away with the choice; the row is what is left.
    requestAnimationFrame(() => rowRefs.current[role]?.focus());
  }

  /** "45m · Due today": block length first, then the task's own due date. */
  function details(outcome: TodayPlanOutcome) {
    const task = outcome.task_id
      ? tasks.find((item) => item.id === outcome.task_id)
      : null;
    return [
      formatPlanMinutes(outcome.duration_minutes),
      task ? describeTaskDue(task.dueDate, today) : null,
      outcome.task_id ? null : "Not saved as a task",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  // A task can hold one role for the day. Leaving the others' tasks out of
  // the list is what keeps the main focus from also being the second task.
  const pickerTasks = tasks.filter(
    (task) =>
      !outcomes.some(
        (outcome) => outcome.role !== pickerRole && outcome.task_id === task.id
      )
  );

  return (
    // One column under the step heading, aligned with it rather than
    // centred: the rows read as a continuation of the question above.
    <div className="w-full max-w-2xl">
      <section
        aria-labelledby="priority-main-label"
        className={cn(
          "border-l-[3px] pl-5 pt-2 transition-colors sm:pl-6",
          mainMissing ? "border-destructive" : "border-primary"
        )}
      >
        <h2
          id="priority-main-label"
          className="text-xs font-semibold uppercase tracking-[0.12em] text-primary"
        >
          Your main focus
        </h2>
        <button
          ref={(node) => {
            rowRefs.current.must_win = node;
          }}
          type="button"
          aria-label={
            main
              ? `Change your main focus: ${main.title}. ${details(main)}`
              : undefined
          }
          onClick={() => openPicker("must_win")}
          className="group -mx-2 flex min-h-16 w-[calc(100%+1rem)] cursor-pointer items-center gap-4 rounded-xl px-2 py-4 text-left transition-colors hover:bg-primary/5 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-ring"
        >
          {main ? (
            <span className="min-w-0 flex-1">
              <span className="block break-words text-lg font-medium leading-snug sm:text-xl">
                {main.title}
              </span>
              <span className="mt-1.5 block text-sm text-muted-foreground">
                {details(main)}
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-lg font-medium text-primary sm:text-xl">
                <Plus className="size-5 shrink-0" aria-hidden="true" />
                Choose your main task
              </span>
              <span className="mt-1.5 block text-sm text-muted-foreground">
                Required. If you finish one thing today, make it this.
              </span>
            </span>
          )}
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary"
          >
            {main && <span className="hidden min-[400px]:inline">Change</span>}
            <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>
      </section>

      <section
        aria-labelledby="priority-second-label"
        className="mt-5 border-t pt-5 pl-[23px] sm:pl-[27px]"
      >
        <h2 id="priority-second-label" className="text-sm font-medium">
          Also worth doing
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            Optional
          </span>
        </h2>
        <div className="mt-1 flex items-center gap-1">
          <button
            ref={(node) => {
              rowRefs.current.progress = node;
            }}
            type="button"
            aria-label={
              second
                ? `Change your second task: ${second.title}. ${details(second)}`
                : undefined
            }
            onClick={() => openPicker("progress")}
            className="group -mx-2 flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-ring"
          >
            {second ? (
              <span className="min-w-0 flex-1">
                <span className="block break-words text-base leading-snug">
                  {second.title}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {details(second)}
                </span>
              </span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2 text-base text-muted-foreground">
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                Choose a second task
              </span>
            )}
            <ChevronRight
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            />
          </button>
          {second && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove second task"
              onClick={() => remove("progress")}
              className="size-11 shrink-0 text-muted-foreground hover:text-foreground sm:size-11"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </section>

      <section
        aria-labelledby="priority-recharge-label"
        className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-5"
      >
        <Leaf
          aria-hidden="true"
          className="size-5 shrink-0 text-primary/75"
        />
        <div className="min-w-0 flex-1 basis-40">
          <h2 id="priority-recharge-label" className="text-sm font-medium">
            A moment to recharge
          </h2>
          <p className="text-sm text-muted-foreground">
            {recharge
              ? `${formatPlanMinutes(recharge.duration_minutes)} set aside for it`
              : "Make room for yourself, too."}
          </p>
        </div>
        <div className="flex max-w-full items-center gap-1">
          <Button
            ref={(node: HTMLButtonElement | null) => {
              rowRefs.current.health = node;
            }}
            type="button"
            variant="outline"
            aria-label={
              recharge
                ? `Change your recharge moment: ${recharge.title}`
                : "Add a moment to recharge"
            }
            onClick={() => openPicker("health")}
            className="h-11 max-w-full justify-start rounded-[10px] px-3.5 text-sm sm:h-11 sm:max-w-72 sm:px-3.5"
          >
            {recharge ? (
              <>
                <span className="min-w-0 truncate">{recharge.title}</span>
                <ChevronRight aria-hidden="true" className="ml-1 size-4 shrink-0" />
              </>
            ) : (
              <>
                <Plus aria-hidden="true" className="mr-1 size-4" />
                Add
              </>
            )}
          </Button>
          {recharge && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove recharge moment"
              onClick={() => remove("health")}
              className="size-11 shrink-0 text-muted-foreground hover:text-foreground sm:size-11"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <PriorityPickerDialog
        role={pickerRole}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        outcome={pickerRole ? outcomeFor(pickerRole) : null}
        tasks={pickerTasks}
        today={today}
        creating={pickerRole !== null && creatingRole === pickerRole}
        createError={
          pickerRole && createError?.role === pickerRole
            ? createError.message
            : null
        }
        returnFocusRef={returnFocusRef}
        onSelectTask={(task) => {
          if (!pickerRole) return;
          onSelectTask(pickerRole, task);
          closeWith(`${task.title} is your ${SLOT_NAMES[pickerRole]}.`);
        }}
        onCreateTask={async (title) => {
          if (!pickerRole) return false;
          const role = pickerRole;
          const created = await onCreateTask(role, title);
          if (created) {
            closeWith(`Created ${title} as your ${SLOT_NAMES[role]}.`);
          }
          return created;
        }}
        onUseText={(title) => {
          if (!pickerRole) return;
          onUseText(pickerRole, title);
          closeWith(`${title} is your ${SLOT_NAMES[pickerRole]}.`);
        }}
        onDurationChange={(minutes) => {
          if (pickerRole) onDurationChange(pickerRole, minutes);
        }}
        onRemove={() => {
          if (pickerRole) remove(pickerRole);
        }}
      />
    </div>
  );
}

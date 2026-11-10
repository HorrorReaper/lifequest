"use client";

import { useRef, useState, type RefObject } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TaskCombobox } from "@/components/planning/TaskCombobox";
import type { TodayPlannerTask } from "@/components/planning/TodayPlanner";
import {
  MAX_OUTCOME_MINUTES,
  MIN_OUTCOME_MINUTES,
  type TodayPlanOutcome,
} from "@/lib/today-plan";
import type { DayPlanOutcomeRole } from "@/lib/types";

/** What the picker says for each role, and whether the slot may be emptied. */
const PICKER_COPY: Record<
  DayPlanOutcomeRole,
  { title: string; description: string; noun: string; removable: boolean }
> = {
  must_win: {
    title: "Choose your main task",
    description: "If you finish one thing today, make it this.",
    noun: "main focus",
    removable: false,
  },
  progress: {
    title: "Choose a second task",
    description: "Only if there is room after your main focus.",
    noun: "second task",
    removable: true,
  },
  health: {
    title: "A moment to recharge",
    description: "A walk, a stretch, real rest. Pick a task or write your own.",
    noun: "recharge moment",
    removable: true,
  },
};

/** Starting points for recovery, used as plain text rather than tasks. */
const RECHARGE_IDEAS = ["Go for a walk", "Stretch for 10 minutes", "Read a book"];

export interface PriorityPickerDialogProps {
  /** The slot being edited; null while no picker has been opened yet. */
  role: DayPlanOutcomeRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outcome: TodayPlanOutcome | null;
  /** Tasks this slot may take: the ones used by another slot are left out. */
  tasks: TodayPlannerTask[];
  today: string;
  creating: boolean;
  createError: string | null;
  /** Where focus goes when the picker closes: the row that opened it. */
  returnFocusRef: RefObject<HTMLElement | null>;
  onSelectTask: (task: TodayPlannerTask) => void;
  /** Creates a task from the title; resolves false when that failed. */
  onCreateTask: (title: string) => Promise<boolean>;
  onUseText: (title: string) => void;
  onDurationChange: (minutes: number) => void;
  onRemove: () => void;
}

/**
 * The compact picker behind each priority row: search, pick, or create.
 *
 * Choosing closes it straight away, so the overview behind shows the result
 * at once. The block length lives here rather than on the overview, which
 * keeps the step to three quiet rows.
 */
export function PriorityPickerDialog({
  role,
  open,
  onOpenChange,
  outcome,
  tasks,
  today,
  creating,
  createError,
  returnFocusRef,
  onSelectTask,
  onCreateTask,
  onUseText,
  onDurationChange,
  onRemove,
}: PriorityPickerDialogProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const copy = role ? PICKER_COPY[role] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85svh] gap-5 overflow-y-auto p-5 sm:max-w-md"
        // A pointer or keyboard goes straight to the search. A finger does
        // not: the on-screen keyboard would cover the list it came to see.
        initialFocus={(type) =>
          type === "touch" ? titleRef.current : searchRef.current
        }
        finalFocus={returnFocusRef}
      >
        {copy && role && (
          <PickerBody
            // Fresh search and length field every time the picker opens.
            key={`${role}-${open}`}
            role={role}
            copy={copy}
            outcome={outcome}
            tasks={tasks}
            today={today}
            creating={creating}
            createError={createError}
            searchRef={searchRef}
            titleRef={titleRef}
            onSelectTask={onSelectTask}
            onCreateTask={onCreateTask}
            onUseText={onUseText}
            onDurationChange={onDurationChange}
            onRemove={onRemove}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({
  role,
  copy,
  outcome,
  tasks,
  today,
  creating,
  createError,
  searchRef,
  titleRef,
  onSelectTask,
  onCreateTask,
  onUseText,
  onDurationChange,
  onRemove,
}: {
  role: DayPlanOutcomeRole;
  copy: (typeof PICKER_COPY)[DayPlanOutcomeRole];
  outcome: TodayPlanOutcome | null;
  tasks: TodayPlannerTask[];
  today: string;
  creating: boolean;
  createError: string | null;
  searchRef: RefObject<HTMLInputElement | null>;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onSelectTask: (task: TodayPlannerTask) => void;
  onCreateTask: (title: string) => Promise<boolean>;
  onUseText: (title: string) => void;
  onDurationChange: (minutes: number) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState("");
  // What is being typed into the length field while it is not yet a usable
  // number. Committing on every keystroke instead would clamp "9" up to the
  // minimum before "90" could ever be finished.
  const [lengthDraft, setLengthDraft] = useState<string | null>(null);
  const filled = Boolean(outcome?.title.trim());

  function changeLength(raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
    setLengthDraft(digits);
    const minutes = Number(digits);
    if (
      digits !== "" &&
      minutes >= MIN_OUTCOME_MINUTES &&
      minutes <= MAX_OUTCOME_MINUTES
    ) {
      onDurationChange(minutes);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle
          ref={titleRef}
          tabIndex={-1}
          className="pr-8 text-lg leading-snug outline-none"
        >
          {filled ? `Change your ${copy.noun}` : copy.title}
        </DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>

      {filled && outcome && (
        <div className="space-y-3 border-y py-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Planned for today</p>
            <p className="mt-0.5 break-words text-base font-medium">
              {outcome.title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {outcome.task_id ? "Linked to a task" : "Not saved as a task"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Named for what it becomes on the timeline. */}
            <label
              htmlFor="priority-block-length"
              className="text-sm text-muted-foreground"
            >
              Block length
            </label>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Input
                id="priority-block-length"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Block length in minutes"
                value={lengthDraft ?? String(outcome.duration_minutes)}
                onChange={(event) => changeLength(event.target.value)}
                // Anything half-typed or out of range never reached the
                // outcome, so dropping the draft snaps the field back to
                // what is actually planned.
                onBlur={() => setLengthDraft(null)}
                className="h-11 w-20 text-center text-base tabular-nums sm:h-11 md:text-base"
              />
              min
            </span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <TaskCombobox
          inline
          inputRef={searchRef}
          ariaLabel="Search your tasks"
          tasks={tasks}
          today={today}
          linkedTaskId={outcome?.task_id ?? null}
          value={query}
          onChangeText={setQuery}
          onSelectTask={onSelectTask}
          onCreateTask={(title) => void onCreateTask(title)}
          onUseText={onUseText}
          creating={creating}
          placeholder="Search tasks, or type a new one"
        />

        {tasks.length === 0 && !query.trim() && (
          <p className="text-sm text-muted-foreground">
            No open tasks yet. Type a title above to create one.
          </p>
        )}

        {role === "health" && !query.trim() && (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-muted-foreground">Or start with</p>
            <div className="flex flex-wrap gap-2">
              {RECHARGE_IDEAS.map((idea) => (
                <Button
                  key={idea}
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl px-3.5 text-sm sm:h-11 sm:px-3.5"
                  onClick={() => onUseText(idea)}
                >
                  {idea}
                </Button>
              ))}
            </div>
          </div>
        )}

        {createError && (
          <p role="alert" className="text-sm text-destructive">
            {createError}
          </p>
        )}
      </div>

      {filled && copy.removable && (
        <div className="border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-11 text-destructive hover:text-destructive sm:h-11"
            onClick={onRemove}
          >
            <Trash2 className="mr-1.5 size-4" />
            Remove from today
          </Button>
        </div>
      )}
    </>
  );
}

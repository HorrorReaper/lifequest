"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import type { DayPlanBlock, DayPlanCategory } from "@/lib/types";
import {
  applyBlockTimeChange,
  blocksOverlapping,
  describeRipple,
  formatPlanMinutes,
  PRIORITY_LABELS,
  shiftEndTime,
  timeToMinutes,
} from "@/lib/today-plan";
import { cn } from "@/lib/utils";

export const CATEGORY_LABELS: Record<DayPlanCategory, string> = {
  deep_work: "Deep Work",
  meeting: "Meeting",
  break: "Break",
  personal: "Personal",
  exercise: "Exercise",
  other: "Other",
};

// Defined with the plan model so the dashboard (a server component) can use
// the same names; re-exported for the planner's components.
export { PRIORITY_LABELS };

interface BlockEditorDialogProps {
  block: DayPlanBlock | null;
  blocks: DayPlanBlock[];
  dayStart: string;
  dayEnd: string;
  onOpenChange: (open: boolean) => void;
  /** The whole day after the edit, later blocks included when they moved. */
  onApply: (blocks: DayPlanBlock[]) => void;
  /** Takes the block out of today's plan. */
  onRemove: (block: DayPlanBlock) => void;
  /** For a habit or reflection block: keep it on today's list, without time. */
  onKeepFlexible?: (block: DayPlanBlock) => void;
}

type RippleMode = "carry" | "only";

/**
 * A block's exact times, name and type, applied together.
 *
 * Everything a drag can do on the timeline can be done here by typing.
 * Changes wait for Apply: when a new end time would push later blocks, the
 * dialog first names them and by how much, and lets the user keep them
 * where they are instead. Problems are stated at the field they belong to.
 */
export function BlockEditorDialog({
  block,
  onOpenChange,
  ...rest
}: BlockEditorDialogProps) {
  return (
    <Dialog open={Boolean(block)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-md">
        {block && (
          <BlockForm
            key={block.id}
            block={block}
            onClose={() => onOpenChange(false)}
            {...rest}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BlockForm({
  block,
  blocks,
  dayStart,
  dayEnd,
  onClose,
  onApply,
  onRemove,
  onKeepFlexible,
}: Omit<BlockEditorDialogProps, "block" | "onOpenChange"> & {
  block: DayPlanBlock;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [start, setStart] = useState(block.start_time);
  const [end, setEnd] = useState(block.end_time);
  const [category, setCategory] = useState<DayPlanCategory>(block.category);
  const [rippleMode, setRippleMode] = useState<RippleMode>("carry");

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const timesReadable = Number.isFinite(startMinutes) && Number.isFinite(endMinutes);

  const titleError = title.trim() ? null : "Give this block a title.";
  const startError = Number.isFinite(startMinutes) ? null : "Enter a start time.";
  const endError = !Number.isFinite(endMinutes)
    ? "Enter an end time."
    : timesReadable && endMinutes <= startMinutes
      ? "The end time has to be after the start time."
      : null;
  const valid = !titleError && !startError && !endError;

  const carried = valid
    ? applyBlockTimeChange(blocks, block.id, { start_time: start, end_time: end })
    : blocks;
  const ripple = valid ? describeRipple(blocks, carried, block.id) : [];
  const result =
    rippleMode === "carry"
      ? carried
      : blocks.map((item) =>
          item.id === block.id ? { ...item, start_time: start, end_time: end } : item
        );
  const conflicts = valid
    ? blocksOverlapping(result, startMinutes, endMinutes, block.id)
    : [];
  const conflictText =
    conflicts.length > 0
      ? `Overlaps “${conflicts[0].title || "Untitled block"}” (${conflicts[0].start_time}–${conflicts[0].end_time}). You can still apply and space them out on the timeline.`
      : null;
  // A conflict belongs to the edge that runs into the other block.
  const conflictAtStart =
    conflicts.length > 0 && timeToMinutes(conflicts[0].start_time) < startMinutes;

  const outsideDay =
    valid &&
    (startMinutes < timeToMinutes(dayStart) || endMinutes > timeToMinutes(dayEnd));

  const isAnchor = block.source_type === "habit" || block.source_type === "journal";

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onApply(
          result.map((item) =>
            item.id === block.id ? { ...item, title: title.trim(), category } : item
          )
        );
        onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">Edit block</DialogTitle>
        <DialogDescription>
          Exact times here; dragging on the timeline does the same.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <label htmlFor="block-title" className="block text-sm font-medium">
          Title
        </label>
        <Input
          id="block-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={160}
          aria-invalid={titleError ? true : undefined}
          aria-describedby={titleError ? "block-title-error" : undefined}
          className="h-11 rounded-xl text-base sm:h-11 md:text-base"
        />
        {titleError && (
          <p id="block-title-error" role="alert" className="text-sm text-destructive">
            {titleError}
          </p>
        )}
        {block.outcome_role && (
          <p className="text-sm text-muted-foreground">
            {PRIORITY_LABELS[block.outcome_role]} for today
            {block.source_type === "task" ? " · linked to a task" : ""}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PlanTimeField
          label="Starts"
          value={start}
          onChange={(value) => {
            // Moving the start keeps the length, as dragging does.
            setEnd(shiftEndTime(start, end, value));
            setStart(value);
          }}
          error={startError}
          hint={
            conflictText && conflictAtStart ? (
              <span className="text-amber-800 dark:text-amber-200">{conflictText}</span>
            ) : null
          }
        />
        <PlanTimeField
          label="Ends"
          value={end}
          onChange={setEnd}
          error={endError}
          hint={
            conflictText && !conflictAtStart ? (
              <span className="text-amber-800 dark:text-amber-200">{conflictText}</span>
            ) : valid ? (
              formatPlanMinutes(endMinutes - startMinutes)
            ) : null
          }
        />
      </div>

      {outsideDay && (
        <p className="text-sm text-muted-foreground">
          Outside your day hours ({dayStart}–{dayEnd}). It still counts as
          planned time.
        </p>
      )}

      {ripple.length > 0 && (
        <fieldset className="space-y-2 rounded-xl border p-3">
          <legend className="px-1 text-sm font-medium">
            {ripple.length === 1
              ? "This change moves 1 later block"
              : `This change moves ${ripple.length} later blocks`}
          </legend>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {ripple.slice(0, 4).map(({ block: moved, shiftMinutes }) => (
              <li key={moved.id} className="break-words">
                {moved.title || "Untitled block"} →{" "}
                {moved.start_time} ({shiftMinutes > 0 ? "+" : "−"}
                {formatPlanMinutes(shiftMinutes)})
              </li>
            ))}
            {ripple.length > 4 && <li>and {ripple.length - 4} more</li>}
          </ul>
          <div className="grid gap-1">
            {(
              [
                ["carry", "Move them along"],
                ["only", "Keep them where they are"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring"
              >
                <input
                  type="radio"
                  name="ripple-mode"
                  checked={rippleMode === value}
                  onChange={() => setRippleMode(value)}
                  className="size-4 accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="space-y-1.5">
        <label htmlFor="block-category" className="block text-sm font-medium">
          Type
        </label>
        <select
          id="block-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as DayPlanCategory)}
          className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-x-2 gap-y-1 border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onRemove(block);
            onClose();
          }}
          className="-ml-2 text-destructive hover:text-destructive"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Remove from plan
        </Button>
        {isAnchor && onKeepFlexible && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onKeepFlexible(block);
              onClose();
            }}
          >
            Keep flexible instead
          </Button>
        )}
        <p className={cn("basis-full text-sm text-muted-foreground")}>
          {block.source_type === "task"
            ? "Removing it keeps the task in your task list."
            : isAnchor
              ? "Removing it keeps the habit or reflection and its history."
              : "Only today's plan changes."}
        </p>
      </div>

      <DialogFooter className="-mx-5 -mb-5 bg-transparent p-5 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Apply
        </Button>
      </DialogFooter>
    </form>
  );
}

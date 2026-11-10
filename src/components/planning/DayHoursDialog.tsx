"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PlanTimeField } from "@/components/planning/PlanTimeField";
import type { DayPlanBlock } from "@/lib/types";
import { blocksOutsideDay, timeToMinutes } from "@/lib/today-plan";

export interface DayHours {
  day_start: string;
  day_end: string;
  /** "" when there is no day-end reminder. */
  shutdown_time: string;
}

interface DayHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hours: DayHours;
  blocks: DayPlanBlock[];
  onApply: (hours: DayHours) => void;
}

/**
 * Edits when the day starts and ends, and the optional day-end reminder.
 *
 * Nothing changes until Apply. Blocks that would fall outside the new hours
 * are named before applying and then stay where they are: moving or
 * deleting someone's plan because they narrowed their day would be a
 * surprise, so the timeline marks them instead.
 */
export function DayHoursDialog({
  open,
  onOpenChange,
  hours,
  blocks,
  onApply,
}: DayHoursDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto p-5 sm:max-w-md">
        {open && (
          <DayHoursForm
            hours={hours}
            blocks={blocks}
            onCancel={() => onOpenChange(false)}
            onApply={(next) => {
              onApply(next);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DayHoursForm({
  hours,
  blocks,
  onCancel,
  onApply,
}: {
  hours: DayHours;
  blocks: DayPlanBlock[];
  onCancel: () => void;
  onApply: (hours: DayHours) => void;
}) {
  const [start, setStart] = useState(hours.day_start);
  const [end, setEnd] = useState(hours.day_end);
  const [reminderOn, setReminderOn] = useState(hours.shutdown_time !== "");
  const [reminder, setReminder] = useState(
    hours.shutdown_time || hours.day_end
  );

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const reminderMinutes = timeToMinutes(reminder);

  const startError = Number.isFinite(startMinutes)
    ? null
    : "Enter when your day starts.";
  const endError = !Number.isFinite(endMinutes)
    ? "Enter when your day ends."
    : Number.isFinite(startMinutes) && endMinutes <= startMinutes
      ? "Your day has to end after it starts."
      : null;
  const reminderError = !reminderOn
    ? null
    : !Number.isFinite(reminderMinutes)
      ? "Choose a time for the reminder, or turn it off."
      : Number.isFinite(startMinutes) && reminderMinutes <= startMinutes
        ? "The reminder has to come after your day starts."
        : null;
  const valid = !startError && !endError && !reminderError;

  const outside = valid ? blocksOutsideDay(blocks, start, end) : [];

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onApply({
          day_start: start,
          day_end: end,
          shutdown_time: reminderOn ? reminder : "",
        });
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">Your day hours</DialogTitle>
        <DialogDescription>
          The time you plan into. Unplanned hours are counted against it.
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <PlanTimeField
          label="Day starts"
          value={start}
          onChange={setStart}
          error={startError}
        />
        <PlanTimeField
          label="Day ends"
          value={end}
          onChange={setEnd}
          error={endError}
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Day-end reminder</span>
            <span className="block text-sm text-muted-foreground">
              Optional. A marker on the timeline; it reserves no time.
            </span>
          </span>
          <Switch checked={reminderOn} onCheckedChange={setReminderOn} />
        </label>
        {reminderOn && (
          <PlanTimeField
            label="Reminder at"
            value={reminder}
            onChange={setReminder}
            error={reminderError}
            className="max-w-[calc(50%-0.375rem)]"
          />
        )}
      </div>

      {outside.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/35 bg-amber-500/8 p-3 text-sm"
        >
          <p className="font-medium">
            {outside.length === 1
              ? "1 block falls outside these hours."
              : `${outside.length} blocks fall outside these hours.`}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
            {outside.map((block) => (
              <li key={block.id} className="break-words">
                {block.title || "Untitled block"} · {block.start_time}–
                {block.end_time}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted-foreground">
            They stay where they are and are marked on the timeline.
          </p>
        </div>
      )}

      <DialogFooter className="-mx-5 -mb-5 bg-transparent p-5 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Apply
        </Button>
      </DialogFooter>
    </form>
  );
}

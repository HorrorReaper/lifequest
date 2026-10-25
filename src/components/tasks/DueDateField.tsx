"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { addDays } from "@/lib/dates";
import { formatTaskDate } from "@/lib/task-manager";
import { cn } from "@/lib/utils";

type DueChoice = "today" | "tomorrow" | "date" | "none";

const CHOICES: Array<{ value: DueChoice; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "date", label: "Choose date" },
  { value: "none", label: "No date" },
];

function choiceFor(value: string | null, today: string): DueChoice {
  if (!value) return "none";
  if (value === today) return "today";
  if (value === addDays(today, 1)) return "tomorrow";
  return "date";
}

interface DueDateFieldProps {
  /** A `YYYY-MM-DD` date key, or null for no due date. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** The user's current day, from their profile timezone. */
  today: string;
  disabled?: boolean;
}

/**
 * The due date as four plain choices, with the calendar behind one of them.
 *
 * Most tasks are due today, tomorrow or not at all, so those are one tap each
 * and the calendar only opens for the rest. The summary line under the
 * buttons says what will be saved, in words, before anything is saved.
 */
export function DueDateField({
  value,
  onChange,
  today,
  disabled = false,
}: DueDateFieldProps) {
  // "Choose date" stays selected once pressed, whatever the date currently
  // is -- otherwise, on a task due today or with none, the button would snap
  // straight back to "Today" or "No date" and the calendar never appear.
  const [choosing, setChoosing] = useState(false);
  const derived = choiceFor(value, today);
  const active: DueChoice = choosing ? "date" : derived;

  function pick(choice: DueChoice) {
    setChoosing(choice === "date");
    if (choice === "today") onChange(today);
    if (choice === "tomorrow") onChange(addDays(today, 1));
    if (choice === "none") onChange(null);
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="size-4 text-muted-foreground" />
        Due date
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={active === choice.value}
            onClick={() => pick(choice.value)}
            className={cn(
              "min-h-11 rounded-xl border bg-background px-3 text-sm font-medium transition-colors",
              "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              active === choice.value &&
                "border-primary bg-primary/10 text-foreground ring-1 ring-primary/30",
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {active === "date" && (
        <label htmlFor="task-due-date" className="sr-only">
          Due date
        </label>
      )}
      {active === "date" && (
        <DatePicker
          id="task-due-date"
          value={value}
          onChange={(next) => {
            onChange(next);
            if (!next) setChoosing(false);
          }}
          disabled={disabled}
        />
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {value
          ? `Due ${value === today ? "today" : value === addDays(today, 1) ? "tomorrow" : formatTaskDate(value)}. Planning it into a day is separate.`
          : active === "date"
            ? "Pick a day in the calendar."
            : "No due date. It stays in No Date until you give it one."}
      </p>
    </fieldset>
  );
}

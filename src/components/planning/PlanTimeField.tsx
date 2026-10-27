"use client";

import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PlanTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown under the field and tied to it; marks the field invalid. */
  error?: string | null;
  /** A quieter note under the field, such as a conflict that is allowed. */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * A labelled "HH:mm" field with its problem stated right under it.
 *
 * The planner's dialogs all ask for times, and each must explain what is
 * wrong where it is wrong rather than in a banner somewhere else. 16px text
 * so a phone does not zoom in on focus.
 */
export function PlanTimeField({
  label,
  value,
  onChange,
  error,
  hint,
  disabled,
  className,
}: PlanTimeFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const hasMessage = Boolean(error || hint);

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        className="h-11 rounded-xl text-base tabular-nums sm:h-11 md:text-base"
      />
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <div id={messageId} className="text-sm text-muted-foreground">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

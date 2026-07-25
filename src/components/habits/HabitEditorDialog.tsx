"use client";

import { useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import type { Habit } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const HABIT_COLORS = [
  { value: "blue", label: "Ocean", className: "bg-sky-500" },
  { value: "green", label: "Forest", className: "bg-emerald-500" },
  { value: "orange", label: "Sunset", className: "bg-orange-500" },
  { value: "purple", label: "Violet", className: "bg-violet-500" },
  { value: "pink", label: "Rose", className: "bg-rose-500" },
  { value: "yellow", label: "Gold", className: "bg-amber-400" },
] as const;

export function habitColorClass(color: string) {
  return (
    HABIT_COLORS.find((option) => option.value === color)?.className ??
    "bg-sky-500"
  );
}

export interface HabitEditorValue {
  name: string;
  emoji: string;
  color: string;
}

interface HabitEditorDialogProps {
  open: boolean;
  habit?: Habit | null;
  busy?: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: HabitEditorValue) => void | Promise<void>;
}

export function HabitEditorDialog({
  open,
  habit,
  busy = false,
  error,
  onOpenChange,
  onSubmit,
}: HabitEditorDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="bottom-0 left-0 top-auto h-[min(42rem,calc(100svh-var(--safe-area-bottom)))] max-h-none max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-b-none rounded-t-3xl p-5 pb-[calc(1.25rem+var(--safe-area-bottom))] sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90svh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:p-6">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">
            {habit ? "Edit habit" : "Create a daily habit"}
          </DialogTitle>
          <DialogDescription>
            Make the behavior easy to recognize when you check in.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <HabitEditorForm
            key={habit?.id ?? "new-habit"}
            habit={habit}
            busy={busy}
            error={error}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function HabitEditorForm({
  habit,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  habit?: Habit | null;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (value: HabitEditorValue) => void | Promise<void>;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? "✅");
  const [color, setColor] = useState(habit?.color ?? "blue");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    void onSubmit({ name, emoji, color });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="habit-name">Name</Label>
            <div className="flex gap-2">
              <EmojiPicker
                value={emoji}
                onChange={setEmoji}
                label="Choose habit icon"
                disabled={busy}
              />
              <Input
                id="habit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Read for 20 minutes"
                maxLength={100}
                autoFocus
                disabled={busy}
                className="h-11"
              />
            </div>
          </div>

          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-sm font-medium">Color</legend>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Habit color">
              {HABIT_COLORS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={color === option.value}
                  onClick={() => setColor(option.value)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    color === option.value
                      ? "border-foreground/30 bg-muted"
                      : "border-border/60 hover:bg-muted/50"
                  )}
                >
                  <span className={cn("size-3 rounded-full", option.className)} />
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="rounded-2xl border bg-muted/35 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-background">
                <CalendarDays className="size-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-medium">Daily</p>
                <p className="text-xs text-muted-foreground">
                  Habits currently repeat every day.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="sticky bottom-0 mt-auto bg-popover">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Saving…" : habit ? "Save changes" : "Create habit"}
            </Button>
          </DialogFooter>
    </form>
  );
}

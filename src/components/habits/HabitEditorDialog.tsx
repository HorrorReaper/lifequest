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
import { SKILL_CATEGORIES } from "@/lib/skill-categories";
import type { SkillCategory } from "@/lib/skill-categories";

/**
 * A habit's colour, in the two weights the app actually uses.
 *
 * `className` fills a control that has to read as on or chosen. `tint` is
 * for a surface that only carries the colour as a label -- the emoji tile
 * above all, where a saturated block sat behind an emoji that brings its own
 * colours, so two palettes fought inside one square. Elsewhere the app tints
 * and keeps the hue in the foreground (bg-primary/10 text-primary, and
 * bg-orange-500/10 on this very page's own header), which is what these
 * follow.
 */
export const HABIT_COLORS = [
  {
    value: "blue",
    label: "Ocean",
    className: "bg-sky-600",
    tint: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    value: "green",
    label: "Forest",
    className: "bg-emerald-600",
    tint: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    value: "orange",
    label: "Sunset",
    className: "bg-orange-600",
    tint: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  {
    value: "purple",
    label: "Violet",
    className: "bg-violet-600",
    tint: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    value: "pink",
    label: "Rose",
    className: "bg-rose-600",
    tint: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  {
    value: "yellow",
    label: "Gold",
    className: "bg-amber-500",
    tint: "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  },
] as const;

/** The filled weight, for a control that is on or chosen. */
export function habitColorClass(color: string) {
  return (
    HABIT_COLORS.find((option) => option.value === color)?.className ??
    "bg-sky-600"
  );
}

/** The quiet weight, for a surface that only labels which habit this is. */
export function habitTintClass(color: string) {
  return (
    HABIT_COLORS.find((option) => option.value === color)?.tint ??
    "bg-sky-500/10 text-sky-700 dark:text-sky-300"
  );
}

export interface HabitEditorValue {
  name: string;
  emoji: string;
  color: string;
  skillCategory: SkillCategory | null;
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
  const [skillCategory, setSkillCategory] = useState<SkillCategory | null>(
    habit?.skill_category ?? null
  );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    void onSubmit({ name, emoji, color, skillCategory });
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

          <fieldset className="space-y-2" disabled={busy}>
            <legend className="text-sm font-medium">Skill (optional)</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Habit skill category">
              {SKILL_CATEGORIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={skillCategory === option.id}
                  onClick={() =>
                    setSkillCategory(skillCategory === option.id ? null : option.id)
                  }
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    skillCategory === option.id
                      ? "border-foreground/30 bg-muted"
                      : "border-border/60 hover:bg-muted/50"
                  )}
                >
                  <span aria-hidden="true">{option.emoji}</span>
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

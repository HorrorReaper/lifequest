"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Archive, BarChart3, CalendarDays, ChevronDown, Loader2 } from "lucide-react";
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

/**
 * The icon a new habit starts with.
 *
 * A seedling rather than the green tick this used to be: next to a still
 * empty check-in circle, a tick read as "already done".
 */
export const DEFAULT_HABIT_EMOJI = "🌱";

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
  /** Edit mode only: shows "Archive habit"; the caller asks for confirmation. */
  onArchive?: () => void;
  /** Edit mode only: shows a "Details & stats" link to this path. */
  detailsHref?: string;
}

export function HabitEditorDialog({
  open,
  habit,
  busy = false,
  error,
  onOpenChange,
  onSubmit,
  onArchive,
  detailsHref,
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
            A name is enough. Habits repeat every day.
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
            onArchive={habit ? onArchive : undefined}
            detailsHref={habit ? detailsHref : undefined}
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
  onArchive,
  detailsHref,
}: {
  habit?: Habit | null;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (value: HabitEditorValue) => void | Promise<void>;
  onArchive?: () => void;
  detailsHref?: string;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? DEFAULT_HABIT_EMOJI);
  const [color, setColor] = useState(habit?.color ?? "blue");
  const [skillCategory, setSkillCategory] = useState<SkillCategory | null>(
    habit?.skill_category ?? null
  );
  // Icon, colour and skill are details; a new habit needs only its name.
  // Editing opens them, since changing them is often why the editor is open.
  const [detailsOpen, setDetailsOpen] = useState(Boolean(habit));
  // Blocks a second submit in the same frame, before `busy` re-renders.
  const submittingRef = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy || submittingRef.current) return;
    submittingRef.current = true;
    try {
      await onSubmit({ name, emoji, color, skillCategory });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Read for 20 minutes"
              maxLength={100}
              autoFocus
              disabled={busy}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? "habit-editor-error" : undefined}
              className="h-12 text-base"
            />
            {error && (
              <p id="habit-editor-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border bg-muted/35 p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background">
              <CalendarDays className="size-4 text-muted-foreground" />
            </span>
            <div>
              <p className="text-sm font-medium">Daily habit</p>
              <p className="text-sm text-muted-foreground">
                Check it off once a day. Days before you create it never count as missed.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border">
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls="habit-details"
              onClick={() => setDetailsOpen((open) => !open)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span>
                Icon, color and skill{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  detailsOpen && "rotate-180"
                )}
              />
            </button>
            {detailsOpen && (
          <div id="habit-details" className="space-y-5 border-t p-4">
          <div className="flex items-center gap-3">
            <EmojiPicker
              value={emoji}
              onChange={setEmoji}
              label="Choose habit icon"
              disabled={busy}
            />
            <span className="text-sm text-muted-foreground">Icon</span>
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
          </div>
            )}
          </div>


          {(detailsHref || onArchive) && (
            <div className="flex items-center justify-between gap-2 border-t pt-4">
              {detailsHref ? (
                <Link
                  href={detailsHref}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <BarChart3 className="size-4" />
                  Details &amp; stats
                </Link>
              ) : (
                <span />
              )}
              {onArchive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onArchive}
                  disabled={busy}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Archive className="size-4" />
                  Archive habit
                </Button>
              )}
            </div>
          )}

          {/* Sticks to the sheet's real bottom edge and covers its padding. At
              bottom-0 it stopped at the padding, and on a phone the form
              scrolled into view underneath the Save and Cancel buttons. */}
          <DialogFooter className="sticky -bottom-[calc(1.25rem+var(--safe-area-bottom))] -mx-5 mt-auto -mb-[calc(1.25rem+var(--safe-area-bottom))] bg-popover px-5 pb-[calc(1rem+var(--safe-area-bottom))] sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-4">
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

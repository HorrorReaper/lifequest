"use client";

import { CalendarPlus, Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodayPlanAnchor } from "@/lib/today-plan";

interface AlsoTodayProps {
  /** Habits and reflections chosen for today without a time block. */
  anchors: TodayPlanAnchor[];
  /** Whether the record behind an anchor is already done today. */
  isDone: (anchor: TodayPlanAnchor) => boolean;
  onAdd: () => void;
  onSchedule: (anchor: TodayPlanAnchor) => void;
  onRemove: (anchor: TodayPlanAnchor) => void;
}

/**
 * "Also today": what the day should hold without a time of its own.
 *
 * A quiet list under the timeline instead of an anchors step before it.
 * Being on this list is planning, not doing: "Done today" comes from the
 * habit or journal itself, and ticking a habit off stays on the home screen.
 * Removing an item only takes it out of today's plan.
 */
export function AlsoToday({
  anchors,
  isDone,
  onAdd,
  onSchedule,
  onRemove,
}: AlsoTodayProps) {
  return (
    <section aria-labelledby="also-today-heading" className="border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="also-today-heading" className="text-base font-semibold">
            Also today
          </h2>
          <p className="text-sm text-muted-foreground">No time reserved</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onAdd}
          aria-label="Add a habit or reflection without a time"
          className="-mr-2 text-primary hover:text-primary"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add
        </Button>
      </div>

      {anchors.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Habits or reflections you want to keep in mind today, without
          blocking time for them.
        </p>
      ) : (
        <ul className="mt-2 divide-y">
          {anchors.map((anchor) => {
            const done = isDone(anchor);
            return (
              <li key={anchor.id} className="flex items-center gap-2 py-1.5">
                <span aria-hidden="true" className="w-6 shrink-0 text-center text-lg">
                  {anchor.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-medium">
                    {anchor.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {anchor.source_type === "journal" ? "Reflection" : "Habit"}
                    {done && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-primary">
                        · <Check aria-hidden="true" className="size-3.5" />
                        Done today
                      </span>
                    )}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSchedule(anchor)}
                  aria-label={`Reserve a time for ${anchor.title}`}
                  className="min-w-11 shrink-0 px-2.5"
                >
                  <CalendarPlus aria-hidden="true" className="size-4" />
                  <span className="hidden min-[400px]:inline">Set a time</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(anchor)}
                  aria-label={`Remove ${anchor.title} from today's plan`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

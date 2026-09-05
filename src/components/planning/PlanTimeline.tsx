"use client";

import { useRef, useState } from "react";
import { GripHorizontal, Plus } from "lucide-react";
import type { DayPlanBlock, DayPlanCategory, DayPlanMissionType } from "@/lib/types";
import {
  applyBlockTimeChange,
  blockSpanForGap,
  DEFAULT_NEW_BLOCK_MINUTES,
  findTimelineGaps,
  formatPlanMinutes,
  MIN_BLOCK_MINUTES,
  minutesToTime,
  snapToDragGrid,
  timelineWindow,
  timeToMinutes,
  TIMELINE_DRAG_GRID_MINUTES,
  TIMELINE_PX_PER_MINUTE,
} from "@/lib/today-plan";
import { cn } from "@/lib/utils";

interface PlanTimelineProps {
  blocks: DayPlanBlock[];
  dayStart: string;
  dayEnd: string;
  invalidBlockIds: string[];
  overlappingBlockIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (blocks: DayPlanBlock[]) => void;
  /** Called with "HH:mm" bounds when empty time is clicked. */
  onCreateBlock: (startTime: string, endTime: string) => void;
}

type DragMode = "move" | "resize";

interface DragState {
  id: string;
  mode: DragMode;
  pointerId: number;
  originY: number;
  originStart: number;
  originEnd: number;
  originBlocks: DayPlanBlock[];
}

// Kept in step with the dashboard's plan section: a block should read as the
// same kind of work in both places. Mission wins over category.
const MISSION_ACCENT: Record<DayPlanMissionType, string> = {
  main_quest: "border-l-primary bg-primary/8",
  side_quest: "border-l-purple-500 bg-purple-500/8",
  anchor: "border-l-blue-500 bg-blue-500/8",
  recovery: "border-l-green-500 bg-green-500/8",
};

const CATEGORY_ACCENT: Record<string, string> = {
  deep_work: "border-l-purple-500 bg-purple-500/8",
  meeting: "border-l-blue-500 bg-blue-500/8",
  break: "border-l-yellow-500 bg-yellow-500/8",
  personal: "border-l-green-500 bg-green-500/8",
  exercise: "border-l-red-500 bg-red-500/8",
  other: "border-l-muted-foreground/40 bg-muted/40",
};

function accentFor(block: DayPlanBlock) {
  if (block.mission_type) return MISSION_ACCENT[block.mission_type];
  return CATEGORY_ACCENT[block.category as DayPlanCategory] ?? CATEGORY_ACCENT.other;
}

/**
 * The day at scale: a block is as tall as it is long.
 *
 * Replaces a list of identically sized cards where a 90-minute commitment and
 * a 15-minute one looked the same and the gaps between them were invisible.
 * Blocks are dragged to move and pulled at the bottom edge to resize; both go
 * through applyBlockTimeChange, so the rest of the day follows along.
 */
export function PlanTimeline({
  blocks,
  dayStart,
  dayEnd,
  invalidBlockIds,
  overlappingBlockIds,
  selectedId,
  onSelect,
  onChange,
  onCreateBlock,
}: PlanTimelineProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const { startMinutes, endMinutes } = timelineWindow(blocks, dayStart, dayEnd);
  const spanMinutes = Math.max(60, endMinutes - startMinutes);
  const height = spanMinutes * TIMELINE_PX_PER_MINUTE;

  const hours: number[] = [];
  for (let minute = startMinutes; minute <= endMinutes; minute += 60) {
    hours.push(minute);
  }

  const ordered = blocks
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  function offsetOf(minutes: number) {
    return (minutes - startMinutes) * TIMELINE_PX_PER_MINUTE;
  }

  function beginDrag(
    event: React.PointerEvent<HTMLElement>,
    block: DayPlanBlock,
    mode: DragMode
  ) {
    // Only a primary pointer drags; a right-click or a second finger would
    // otherwise start a second, conflicting gesture.
    if (event.button !== 0) return;
    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: block.id,
      mode,
      pointerId: event.pointerId,
      originY: event.clientY,
      originStart: start,
      originEnd: end,
      // Snapshot the day as it was when the gesture began, so every move is
      // measured from one fixed origin. Applying each move to the previous
      // result instead would let rounding accumulate across a drag.
      originBlocks: blocks,
    };
    setDragging(block.id);
    onSelect(block.id);
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaMinutes = snapToDragGrid(
      (event.clientY - drag.originY) / TIMELINE_PX_PER_MINUTE
    );
    if (drag.mode === "move") {
      const duration = drag.originEnd - drag.originStart;
      const nextStart = Math.min(
        Math.max(drag.originStart + deltaMinutes, 0),
        24 * 60 - 1 - duration
      );
      onChange(
        applyBlockTimeChange(drag.originBlocks, drag.id, {
          start_time: minutesToTime(nextStart),
          end_time: minutesToTime(nextStart + duration),
        })
      );
      return;
    }

    const nextEnd = Math.min(
      Math.max(drag.originEnd + deltaMinutes, drag.originStart + MIN_BLOCK_MINUTES),
      24 * 60 - 1
    );
    onChange(
      applyBlockTimeChange(drag.originBlocks, drag.id, {
        end_time: minutesToTime(nextEnd),
      })
    );
  }

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
  }

  /**
   * Arrow keys do what dragging does.
   *
   * A pointer gesture is the fast path, not the only one: without this the
   * timeline would be unusable by keyboard, and the old time fields at least
   * worked.
   */
  function handleKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    block: DayPlanBlock
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;

    event.preventDefault();
    const step =
      (event.key === "ArrowDown" ? 1 : -1) * TIMELINE_DRAG_GRID_MINUTES;

    if (event.shiftKey) {
      const nextEnd = Math.min(
        Math.max(end + step, start + MIN_BLOCK_MINUTES),
        24 * 60 - 1
      );
      onChange(
        applyBlockTimeChange(blocks, block.id, {
          end_time: minutesToTime(nextEnd),
        })
      );
      return;
    }

    const duration = end - start;
    const nextStart = Math.min(
      Math.max(start + step, 0),
      24 * 60 - 1 - duration
    );
    onChange(
      applyBlockTimeChange(blocks, block.id, {
        start_time: minutesToTime(nextStart),
        end_time: minutesToTime(nextStart + duration),
      })
    );
  }

  const gaps = findTimelineGaps(blocks, startMinutes, endMinutes);

  /** Turns a click inside a gap into a block placed where it landed. */
  function createInGap(
    event: React.MouseEvent<HTMLButtonElement>,
    gap: (typeof gaps)[number]
  ) {
    const track = trackRef.current;
    // Without a measurable track there is no click position to read, so fall
    // back to the top of the gap rather than refusing to add anything.
    const atMinutes = track
      ? startMinutes +
        (event.clientY - track.getBoundingClientRect().top) /
          TIMELINE_PX_PER_MINUTE
      : gap.startMinutes;

    const span = blockSpanForGap(gap, atMinutes);
    onCreateBlock(
      minutesToTime(span.startMinutes),
      minutesToTime(span.endMinutes)
    );
  }

  return (
    <div className="grid grid-cols-[3.25rem_1fr] rounded-2xl border bg-background/55 p-3 sm:p-4">
      {/* Hour gutter */}
      <div className="relative" style={{ height }}>
        {hours.map((minute) => (
          <span
            key={minute}
            className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
            style={{ top: offsetOf(minute) }}
          >
            {minutesToTime(minute)}
          </span>
        ))}
      </div>

      <div ref={trackRef} className="relative border-l" style={{ height }}>
        {hours.map((minute) => (
          <span
            key={minute}
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-border/70"
            style={{ top: offsetOf(minute) }}
          />
        ))}

        {/* Empty time is clickable. Rendered before the blocks so a block
            always wins the pointer where the two meet. */}
        {gaps.map((gap) => {
          const available = gap.endMinutes - gap.startMinutes;
          return (
            <button
              key={`gap-${gap.startMinutes}`}
              type="button"
              onClick={(event) => createInGap(event, gap)}
              aria-label={`Add a block between ${minutesToTime(gap.startMinutes)} and ${minutesToTime(gap.endMinutes)}`}
              className="group absolute inset-x-1 left-2 flex items-center justify-center rounded-lg border border-transparent transition-colors hover:border-dashed hover:border-primary/40 hover:bg-primary/5 focus-visible:border-dashed focus-visible:border-primary/40 focus-visible:bg-primary/5 focus-visible:outline-none"
              style={{
                top: offsetOf(gap.startMinutes),
                height: available * TIMELINE_PX_PER_MINUTE,
              }}
            >
              <span className="flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Plus className="size-3" />
                {/* Say the length up front, since a narrow gap yields a
                    shorter block than the usual hour. */}
                {formatPlanMinutes(
                  Math.min(DEFAULT_NEW_BLOCK_MINUTES, available)
                )}
              </span>
            </button>
          );
        })}

        {ordered.map((block, index) => {
          const start = timeToMinutes(block.start_time);
          const end = timeToMinutes(block.end_time);
          const invalid = invalidBlockIds.includes(block.id);
          const overlapping = overlappingBlockIds.includes(block.id);
          const selected = selectedId === block.id;

          // An unparseable block has no place on a time axis. Rather than
          // drop it -- which would hide the very thing that needs fixing --
          // it is listed after the axis by the parent's editor.
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return null;
          }

          const duration = end - start;
          const previous = ordered[index - 1];
          const gapBefore = previous
            ? start - (timeToMinutes(previous.end_time) || start)
            : 0;

          return (
            <div key={block.id}>
              {gapBefore >= 20 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background px-2 text-[10px] tabular-nums text-muted-foreground"
                  style={{ top: offsetOf(start) - (gapBefore / 2) * TIMELINE_PX_PER_MINUTE }}
                >
                  {formatPlanMinutes(gapBefore)} free
                </span>
              )}

              <div
                role="button"
                tabIndex={0}
                aria-label={`${block.title || "Untitled block"}, ${block.start_time} to ${block.end_time}`}
                aria-current={selected ? "true" : undefined}
                onPointerDown={(event) => beginDrag(event, block, "move")}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(event) => handleKeyDown(event, block)}
                onClick={() => onSelect(block.id)}
                className={cn(
                  "absolute inset-x-1 left-2 touch-none select-none overflow-hidden rounded-lg border border-l-[3px] px-2.5 py-1.5 text-left transition-shadow",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  accentFor(block),
                  dragging === block.id
                    ? "cursor-grabbing shadow-lg"
                    : "cursor-grab hover:shadow-sm",
                  selected && "ring-2 ring-ring",
                  (invalid || overlapping) && "border-destructive/60 bg-destructive/10"
                )}
                style={{
                  top: offsetOf(start),
                  height: Math.max(duration * TIMELINE_PX_PER_MINUTE, 22),
                }}
              >
                <p className="truncate text-xs font-medium leading-tight">
                  {block.title || "Untitled block"}
                </p>
                {duration >= 25 && (
                  <p className="truncate text-[10px] tabular-nums text-muted-foreground">
                    {block.start_time}&ndash;{block.end_time} &middot;{" "}
                    {formatPlanMinutes(duration)}
                    {overlapping && " · overlaps"}
                  </p>
                )}

                {/* Resize handle. Sits inside the block so the whole bottom
                    edge is grabbable, and stops the move gesture from
                    starting underneath it. */}
                <span
                  aria-hidden="true"
                  onPointerDown={(event) => beginDrag(event, block, "resize")}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-center justify-center opacity-0 transition-opacity hover:opacity-100"
                >
                  <GripHorizontal className="size-3 text-muted-foreground" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

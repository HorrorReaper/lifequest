"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PRIORITY_LABELS } from "@/components/planning/BlockEditorDialog";
import type { DayPlanBlock, DayPlanCategory, DayPlanMissionType } from "@/lib/types";
import {
  applyBlockTimeChange,
  blockSpanForGap,
  COMPRESS_FREE_MINUTES,
  describeRipple,
  findTimelineGaps,
  formatPlanMinutes,
  type TimelineGap,
  type TimelineSegment,
  MIN_BLOCK_MINUTES,
  minuteForOffset,
  minutesToTime,
  offsetForMinute,
  segmentsHeight,
  snapToDragGrid,
  timelineSegments,
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
  /** The day-end reminder, "" for none. Drawn as a marker, never a block. */
  shutdownTime?: string;
  invalidBlockIds: string[];
  overlappingBlockIds: string[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (blocks: DayPlanBlock[]) => void;
  /** Called with "HH:mm" bounds when free time is tapped. */
  onCreateBlock: (startTime: string, endTime: string) => void;
}

/**
 * Below this, a block gets one line: its title and times side by side.
 *
 * At 1.2px per minute a 40-minute block is 48px, the least that carries a
 * title and a second line without clipping either.
 */
const ONE_LINE_MINUTES = 40;

/** Below this even one line of normal text does not fit; it shrinks. */
const TINY_BLOCK_MINUTES = 20;

/** Free time this long or longer gets a visible "+ 30m free" label. */
const LABELLED_GAP_MINUTES = 20;

type DragMode = "move" | "resize";

/** The block a click would create right now, and which gap it belongs to. */
interface GapPreview {
  gapStart: number;
  startMinutes: number;
  endMinutes: number;
}

/** The day and its layout as they were when a drag began. */
interface DragOrigin {
  blocks: DayPlanBlock[];
  segments: TimelineSegment[];
}

interface DragState extends DragOrigin {
  id: string;
  mode: DragMode;
  pointerId: number;
  originY: number;
  originStart: number;
  originEnd: number;
}

// The hue a block shares with the dashboard's plan section, as its left edge
// and a light fill of the same hue. A card-coloured fill disappeared: in the
// default and dark themes the card colour is the page colour. The tint is
// mixed into the card colour rather than laid over it with transparency, so
// the hour lines behind a block do not show through. The main focus gets the
// strongest fill.
const MISSION_ACCENT: Record<DayPlanMissionType, string> = {
  main_quest: "border-l-primary bg-[color-mix(in_oklab,var(--primary)_15%,var(--card))]",
  side_quest: "border-l-purple-500 bg-[color-mix(in_oklab,var(--color-purple-500)_10%,var(--card))]",
  anchor: "border-l-blue-500 bg-[color-mix(in_oklab,var(--color-blue-500)_10%,var(--card))]",
  recovery: "border-l-green-500 bg-[color-mix(in_oklab,var(--color-green-500)_10%,var(--card))]",
};

const CATEGORY_ACCENT: Record<string, string> = {
  deep_work: "border-l-purple-500 bg-[color-mix(in_oklab,var(--color-purple-500)_10%,var(--card))]",
  meeting: "border-l-blue-500 bg-[color-mix(in_oklab,var(--color-blue-500)_10%,var(--card))]",
  break: "border-l-yellow-500 bg-[color-mix(in_oklab,var(--color-yellow-500)_12%,var(--card))]",
  personal: "border-l-green-500 bg-[color-mix(in_oklab,var(--color-green-500)_10%,var(--card))]",
  exercise: "border-l-red-500 bg-[color-mix(in_oklab,var(--color-red-500)_10%,var(--card))]",
  other: "border-l-muted-foreground/50 bg-muted",
};

function accentFor(block: DayPlanBlock) {
  if (block.mission_type) return MISSION_ACCENT[block.mission_type];
  return CATEGORY_ACCENT[block.category as DayPlanCategory] ?? CATEGORY_ACCENT.other;
}

/**
 * The day at scale: a block is as tall as it is long.
 *
 * Blocks are dragged to move and pulled at the bottom edge to resize; both
 * go through applyBlockTimeChange, so the rest of the day follows along, and
 * the line above the axis says so while it happens. Long free stretches fold
 * into one labelled row ("12:00–18:00 · 6h free") that opens on demand, so
 * the day does not begin with a screen of empty hours. Only free time folds:
 * every block keeps its real height and its real distance to its neighbours.
 */
export function PlanTimeline({
  blocks,
  dayStart,
  dayEnd,
  shutdownTime = "",
  invalidBlockIds,
  overlappingBlockIds,
  selectedId,
  onSelect,
  onChange,
  onCreateBlock,
}: PlanTimelineProps) {
  const keyboardHintId = useId();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // A pointer gesture ends in a click on the same element. Now that a click
  // opens a modal, a drag that actually moved must not also open it.
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOrigin, setDragOrigin] = useState<DragOrigin | null>(null);
  const [preview, setPreview] = useState<GapPreview | null>(null);
  const [showFullDay, setShowFullDay] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const { startMinutes, endMinutes } = timelineWindow(blocks, dayStart, dayEnd);
  const gaps = findTimelineGaps(blocks, startMinutes, endMinutes);
  const foldable = gaps.some(
    (gap) => gap.endMinutes - gap.startMinutes >= COMPRESS_FREE_MINUTES
  );
  // The folds stay put while dragging: re-folding under a moving pointer
  // would shift the very block being held.
  const segments =
    dragOrigin?.segments ??
    timelineSegments(
      blocks,
      startMinutes,
      endMinutes,
      (gapStart) => showFullDay || expanded.has(gapStart)
    );
  const height = segmentsHeight(segments);
  const foldedStarts = new Set(
    segments.filter((segment) => segment.collapsed).map((s) => s.startMinutes)
  );

  const hours = new Set<number>();
  for (const segment of segments) {
    if (segment.collapsed) continue;
    for (
      let minute = Math.ceil(segment.startMinutes / 60) * 60;
      minute <= segment.endMinutes;
      minute += 60
    ) {
      hours.add(minute);
    }
  }

  const ordered = blocks
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const dayStartMinutes = timeToMinutes(dayStart);
  const dayEndMinutes = timeToMinutes(dayEnd);
  const shutdownMinutes = timeToMinutes(shutdownTime);

  function offsetOf(minutes: number) {
    return offsetForMinute(segments, minutes);
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
    movedRef.current = false;
    // Snapshot the day as it was when the gesture began, so every move is
    // measured from one fixed origin. Applying each move to the previous
    // result instead would let rounding accumulate across a drag.
    const origin = { blocks, segments };
    dragRef.current = {
      ...origin,
      id: block.id,
      mode,
      pointerId: event.pointerId,
      originY: event.clientY,
      originStart: start,
      originEnd: end,
    };
    setDragOrigin(origin);
    setDragging(block.id);
  }

  /** The minute the pointer points at, measured against the frozen layout. */
  function draggedMinute(drag: DragState, origin: number, clientY: number) {
    const originOffset = offsetForMinute(drag.segments, origin);
    return snapToDragGrid(
      minuteForOffset(drag.segments, originOffset + clientY - drag.originY)
    );
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.mode === "move") {
      const duration = drag.originEnd - drag.originStart;
      const nextStart = Math.min(
        Math.max(draggedMinute(drag, drag.originStart, event.clientY), 0),
        24 * 60 - 1 - duration
      );
      if (nextStart !== drag.originStart) movedRef.current = true;
      onChange(
        applyBlockTimeChange(drag.blocks, drag.id, {
          start_time: minutesToTime(nextStart),
          end_time: minutesToTime(nextStart + duration),
        })
      );
      return;
    }

    const nextEnd = Math.min(
      Math.max(
        draggedMinute(drag, drag.originEnd, event.clientY),
        drag.originStart + MIN_BLOCK_MINUTES
      ),
      24 * 60 - 1
    );
    if (nextEnd !== drag.originEnd) movedRef.current = true;
    onChange(
      applyBlockTimeChange(drag.blocks, drag.id, {
        end_time: minutesToTime(nextEnd),
      })
    );
  }

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(null);
    setDragOrigin(null);
  }

  /**
   * Arrow keys do what dragging does.
   *
   * A pointer gesture is the fast path, not the only one: without this the
   * timeline would be unusable by keyboard.
   */
  function handleKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
    block: DayPlanBlock
  ) {
    // Enter and Space open the block's editor with its exact time fields --
    // the way in for anyone not dragging. A div with role="button" does not
    // get this from the browser the way a <button> would.
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(block.id);
      return;
    }
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

  /**
   * The span a pointer at `clientY` would place inside `gap`.
   *
   * The preview and the click both go through this, so what is highlighted
   * is exactly what gets offered.
   */
  function spanAt(gap: TimelineGap, clientY: number) {
    const track = trackRef.current;
    // Without a measurable track there is no position to read, so fall back
    // to the top of the gap rather than refusing to place anything.
    const atMinutes = track
      ? minuteForOffset(segments, clientY - track.getBoundingClientRect().top)
      : gap.startMinutes;
    return blockSpanForGap(gap, atMinutes);
  }

  function showPreview(gap: TimelineGap, clientY: number) {
    const span = spanAt(gap, clientY);
    // Only re-render when the span actually moves, which happens on crossing
    // an hour boundary rather than on every pixel of travel.
    setPreview((current) =>
      current &&
      current.gapStart === gap.startMinutes &&
      current.startMinutes === span.startMinutes &&
      current.endMinutes === span.endMinutes
        ? current
        : { gapStart: gap.startMinutes, ...span }
    );
  }

  function createInGap(
    event: React.MouseEvent<HTMLButtonElement>,
    gap: TimelineGap
  ) {
    // detail is 0 when the button was activated from the keyboard, where
    // there is no pointer position; place at the top of the gap, which is
    // what focusing it previews.
    const span =
      event.detail === 0
        ? blockSpanForGap(gap, gap.startMinutes)
        : spanAt(gap, event.clientY);

    setPreview(null);
    onCreateBlock(
      minutesToTime(span.startMinutes),
      minutesToTime(span.endMinutes)
    );
  }

  // Said while a drag carries later blocks along, before it is let go.
  const draggedBlock = dragging
    ? blocks.find((block) => block.id === dragging)
    : null;
  const carried =
    dragging && dragOrigin
      ? describeRipple(dragOrigin.blocks, blocks, dragging).length
      : 0;
  const dragNote = draggedBlock
    ? `${draggedBlock.title || "This block"}: ${draggedBlock.start_time}–${draggedBlock.end_time}.${
        carried > 0
          ? ` Also moves ${carried} later ${carried === 1 ? "block" : "blocks"}.`
          : ""
      }`
    : "";

  const anyOpened = showFullDay || expanded.size > 0;

  return (
    // The day gets a surface of its own -- the one card on the step -- so
    // it reads as the thing to work on rather than as more page.
    <div
      data-slot="plan-timeline"
      className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4 dark:bg-muted/50"
    >
      <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
        <p aria-live="polite" className="min-w-0 text-sm text-muted-foreground">
          {dragNote}
        </p>
        {(foldable || anyOpened) && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (anyOpened) {
                setShowFullDay(false);
                setExpanded(new Set());
              } else {
                setShowFullDay(true);
              }
            }}
            className="-mr-2 shrink-0 text-muted-foreground"
          >
            {anyOpened ? "Compact view" : "Show full day"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[3.25rem_1fr]">
        <p id={keyboardHintId} className="sr-only">
          Enter opens exact start and end times. Arrow keys move the block;
          Shift with an arrow key changes its length.
        </p>

        {/* Hour gutter */}
        <div className="relative" style={{ height }}>
          {Array.from(hours).map((minute) => (
            <span
              key={minute}
              className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-muted-foreground"
              style={{ top: offsetOf(minute) }}
            >
              {minutesToTime(minute)}
            </span>
          ))}
        </div>

        <div ref={trackRef} className="relative border-l" style={{ height }}>
          {Array.from(hours).map((minute) => (
            <span
              key={minute}
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-border/70"
              style={{ top: offsetOf(minute) }}
            />
          ))}

          {/* Time outside the day hours, drawn only when a block sits there. */}
          {Number.isFinite(dayStartMinutes) && startMinutes < dayStartMinutes && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bg-muted/60"
              style={{ top: 0, height: offsetOf(dayStartMinutes) }}
            />
          )}
          {Number.isFinite(dayEndMinutes) && endMinutes > dayEndMinutes && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bg-muted/60"
              style={{
                top: offsetOf(dayEndMinutes),
                height: height - offsetOf(dayEndMinutes),
              }}
            />
          )}

          {segments
            .filter((segment) => segment.collapsed)
            .map((segment) => {
              const span = segment.endMinutes - segment.startMinutes;
              const label = `${minutesToTime(segment.startMinutes)}–${minutesToTime(segment.endMinutes)}`;
              return (
                <button
                  key={`fold-${segment.startMinutes}`}
                  type="button"
                  aria-expanded={false}
                  onClick={() =>
                    setExpanded((current) =>
                      new Set(current).add(segment.startMinutes)
                    )
                  }
                  className="absolute inset-x-0 left-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-dashed px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-ring"
                  style={{ top: segment.top + 2, height: segment.height - 4 }}
                >
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums">{label}</span> ·{" "}
                    {formatPlanMinutes(span)} free
                    <span className="sr-only">, folded</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 font-medium text-foreground">
                    Show
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </span>
                </button>
              );
            })}

          {/* Free time is clickable. Rendered before the blocks so a block
              always wins the pointer where the two meet. */}
          {gaps
            .filter((gap) => !foldedStarts.has(gap.startMinutes))
            .map((gap) => {
              const available = gap.endMinutes - gap.startMinutes;
              const shown =
                preview && preview.gapStart === gap.startMinutes ? preview : null;

              return (
                <button
                  key={`gap-${gap.startMinutes}`}
                  type="button"
                  onMouseMove={(event) => showPreview(gap, event.clientY)}
                  onMouseLeave={() => setPreview(null)}
                  onFocus={() =>
                    setPreview({
                      gapStart: gap.startMinutes,
                      ...blockSpanForGap(gap, gap.startMinutes),
                    })
                  }
                  onBlur={() => setPreview(null)}
                  onClick={(event) => createInGap(event, gap)}
                  aria-label={`Add something between ${minutesToTime(gap.startMinutes)} and ${minutesToTime(gap.endMinutes)}`}
                  className="group absolute inset-x-0 left-2 cursor-pointer rounded-lg focus-visible:outline-none"
                  style={{
                    top: offsetOf(gap.startMinutes),
                    height: available * TIMELINE_PX_PER_MINUTE,
                  }}
                >
                  {available >= LABELLED_GAP_MINUTES && !shown && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1 left-2 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground"
                    >
                      <Plus className="size-3.5" />
                      {formatPlanMinutes(available)} free
                    </span>
                  )}
                  {/* The whole gap is the hit area, but only the span that
                      would actually be offered is drawn. */}
                  {shown && (
                    <span
                      aria-hidden="true"
                      data-slot="gap-preview"
                      className="absolute inset-x-0 flex items-center justify-center rounded-lg border border-dashed border-primary/50 bg-primary/10 ring-ring group-focus-visible:ring-3"
                      style={{
                        top:
                          (shown.startMinutes - gap.startMinutes) *
                          TIMELINE_PX_PER_MINUTE,
                        height:
                          (shown.endMinutes - shown.startMinutes) *
                          TIMELINE_PX_PER_MINUTE,
                      }}
                    >
                      <span className="flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Plus className="size-3" />
                        {minutesToTime(shown.startMinutes)}&ndash;
                        {minutesToTime(shown.endMinutes)}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}

          {/* The day-end reminder: a marker, never a block. */}
          {Number.isFinite(shutdownMinutes) &&
            shutdownMinutes >= startMinutes &&
            shutdownMinutes <= endMinutes && (
              <div
                aria-hidden="true"
                data-slot="shutdown-marker"
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-primary/60"
                style={{ top: offsetOf(shutdownMinutes) }}
              >
                <span className="absolute right-0 -translate-y-1/2 rounded-full bg-card px-2 text-xs font-medium text-primary">
                  Day-end reminder · {minutesToTime(shutdownMinutes)}
                </span>
              </div>
            )}

          {ordered.map((block) => {
            const start = timeToMinutes(block.start_time);
            const end = timeToMinutes(block.end_time);
            const invalid = invalidBlockIds.includes(block.id);
            const overlapping = overlappingBlockIds.includes(block.id);
            const selected = selectedId === block.id;

            // An unparseable block has no place on a time axis. Rather than
            // drop it -- which would hide the very thing that needs fixing --
            // it is listed after the axis by the parent.
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
              return null;
            }

            const duration = end - start;
            const oneLine = duration < ONE_LINE_MINUTES;
            const tiny = duration < TINY_BLOCK_MINUTES;
            const outside =
              (Number.isFinite(dayStartMinutes) && start < dayStartMinutes) ||
              (Number.isFinite(dayEndMinutes) && end > dayEndMinutes);
            const details = [
              `${block.start_time}–${block.end_time}`,
              formatPlanMinutes(duration),
              block.outcome_role ? PRIORITY_LABELS[block.outcome_role] : null,
              outside ? "Outside day hours" : null,
              overlapping ? "Overlaps" : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={block.id}
                role="button"
                tabIndex={0}
                aria-label={`${block.title || "Untitled block"}, ${block.start_time} to ${block.end_time}`}
                aria-describedby={keyboardHintId}
                aria-current={selected ? "true" : undefined}
                data-outside={outside ? "true" : undefined}
                onPointerDown={(event) => beginDrag(event, block, "move")}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(event) => handleKeyDown(event, block)}
                onClick={() => {
                  if (movedRef.current) {
                    movedRef.current = false;
                    return;
                  }
                  onSelect(block.id);
                }}
                className={cn(
                  // Centred rather than flowing from the top: a block is as
                  // tall as it is long, so anything past a short one left its
                  // label stranded above a pool of empty colour. The resize
                  // handle is absolute, so it stays on the bottom edge.
                  "absolute inset-x-0 left-2 flex touch-none flex-col justify-center overflow-hidden rounded-lg border border-l-[3px] px-3 text-left select-none transition-shadow",
                  oneLine ? "py-0" : "py-1.5",
                  "focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  accentFor(block),
                  dragging === block.id
                    ? "z-20 cursor-grabbing shadow-lg"
                    : "cursor-grab hover:shadow-sm",
                  selected && "ring-2 ring-ring",
                  outside && "border-dashed",
                  (invalid || overlapping) &&
                    "border-destructive/60 bg-[color-mix(in_oklab,var(--destructive)_12%,var(--card))]"
                )}
                style={{
                  top: offsetOf(start),
                  // The drawn height is the real duration. The floor is the
                  // shortest block the planner will make, so only data from
                  // below its own minimum can still collide.
                  height: Math.max(
                    duration * TIMELINE_PX_PER_MINUTE,
                    MIN_BLOCK_MINUTES * TIMELINE_PX_PER_MINUTE
                  ),
                }}
              >
                {oneLine ? (
                  <p
                    className={cn(
                      "flex min-w-0 items-baseline gap-2 pb-1",
                      tiny ? "text-[11px] leading-none" : "text-sm leading-tight"
                    )}
                  >
                    <span className="truncate font-medium">
                      {block.title || "Untitled block"}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {block.start_time}–{block.end_time}
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="truncate text-sm leading-tight font-medium">
                      {block.title || "Untitled block"}
                    </p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {details}
                    </p>
                  </>
                )}

                {/* Resize handle. Sits inside the block so the whole bottom
                    edge is grabbable, and stops the move gesture from
                    starting underneath it. Always drawn, not only on hover:
                    a touch screen has no hover. A short block gets a thin
                    strip, so tapping it still opens the block. */}
                <span
                  aria-hidden="true"
                  data-slot="resize-handle"
                  onPointerDown={(event) => beginDrag(event, block, "resize")}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className={cn(
                    // The bar sits at the right, clear of the title and
                    // times, which start at the left edge.
                    "absolute inset-x-0 bottom-0 flex cursor-ns-resize touch-none items-end justify-end pr-3",
                    tiny ? "h-1.5" : "h-4 items-center"
                  )}
                >
                  <span
                    className={cn(
                      "rounded-full bg-foreground/40 transition-colors hover:bg-foreground/60",
                      tiny ? "mb-px h-0.5 w-8" : "h-1.5 w-10"
                    )}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

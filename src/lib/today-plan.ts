import type {
  DayPlanBlock,
  DayPlanCategory,
  DayPlanMissionType,
  DayPlanOutcomeRole,
  DayPlanSourceType,
} from "@/lib/types";
import { addDays, formatDateOnly } from "@/lib/dates";
import { isValidMoodValue } from "@/lib/mood";
import {
  MOOD_REASON_NOTE_MAX,
  normalizeMoodReasons,
} from "@/lib/mood-reasons";

export const TODAY_PLAN_NOTES_PREFIX = "LIFEQUEST_TODAY_PLAN_V1:";

/** The last minute a plan block may reach. */
const END_OF_DAY_MINUTES = 23 * 60 + 59;

/**
 * The shortest gap the generated schedule leaves between two blocks.
 *
 * Chaining commitments back to back plans a day nobody can actually walk
 * through; this is the room to stand up and switch context.
 */
export const MIN_TRANSITION_MINUTES = 10;

/**
 * Generated start times land on this grid.
 *
 * Chaining "previous end + transition" alone drifts onto times no person
 * would ever choose -- 09:40, then 11:45, then 12:35. Rounding each start up
 * to a quarter hour keeps the schedule readable, and the few minutes it adds
 * become buffer rather than being lost.
 */
export const PLAN_TIME_GRID_MINUTES = 15;

/**
 * The next grid-aligned minute a block may start on, given what came before.
 *
 * Always at least MIN_TRANSITION_MINUTES after `previousEnd`, so rounding can
 * widen a gap but never close one.
 */
export function nextGridStart(previousEnd: number): number {
  const earliest = previousEnd + MIN_TRANSITION_MINUTES;
  const aligned =
    Math.ceil(earliest / PLAN_TIME_GRID_MINUTES) * PLAN_TIME_GRID_MINUTES;
  return Math.min(aligned, END_OF_DAY_MINUTES);
}

const OUTCOME_ROLES: DayPlanOutcomeRole[] = [
  "must_win",
  "progress",
  "health",
];
const SOURCE_TYPES: DayPlanSourceType[] = [
  "task",
  "habit",
  "journal",
  "workout",
  "manual",
];

/**
 * What each priority is called wherever the day is shown: the timeline, the
 * block editor, the review step and the dashboard's next-up card.
 */
export const PRIORITY_LABELS: Record<DayPlanOutcomeRole, string> = {
  must_win: "Main focus",
  progress: "Second task",
  health: "Recharge",
};

export interface TodayPlanOutcome {
  id: string;
  role: DayPlanOutcomeRole;
  title: string;
  task_id: string | null;
  duration_minutes: number;
}

export interface TodayPlanAnchor {
  id: string;
  source_type: Exclude<DayPlanSourceType, "task">;
  source_id: string | null;
  title: string;
  emoji: string;
  duration_minutes: number;
}

export interface TodayPlanMetadata {
  version: 1;
  intention: string;
  /** How the user said they felt when starting today's ritual; one of the shared mood vocabulary values. Null only for a plan made before the mood step became mandatory, or one not started yet. */
  mood: string | null;
  /** Why it feels that way, as ids from MOOD_REASONS. Optional and possibly several; empty for a plan made before this was asked. */
  mood_reasons: string[];
  /** A reason in the user's own words, when none of the offered ones fit. Empty when unused. */
  mood_reason_note: string;
  outcomes: TodayPlanOutcome[];
  anchors: TodayPlanAnchor[];
  day_start: string;
  day_end: string;
  /**
   * The day-end reminder, "HH:mm", or "" when the user turned it off.
   *
   * A marker on the timeline, never a block: it reserves no time and is not
   * counted as planned. Plans saved before it could be turned off always
   * carry a time.
   */
  shutdown_time: string;
  ritual_completed_at: string | null;
}

export interface ParsedTodayPlanNotes {
  metadata: TodayPlanMetadata | null;
  legacyNotes: string | null;
}

export interface TodayPlanCapacity {
  /** Minutes between the day's start and end. */
  availableMinutes: number;
  /**
   * Minutes covered by at least one valid block, anywhere in the day.
   *
   * Overlapping blocks are counted once: two blocks fighting over the same
   * half hour are a conflict to resolve, not an hour of work.
   */
  plannedMinutes: number;
  /** Planned minutes before the day starts or after it ends. */
  outsideMinutes: number;
  /** Day hours nothing is planned in. Never negative. */
  remainingMinutes: number;
  /** Share of the day hours that is planned. */
  utilizationPercent: number;
  /** "over" means something is planned outside the day hours. */
  status: "open" | "balanced" | "full" | "over";
}

export interface TodayPlanBlockProblems {
  invalidBlockIds: string[];
  overlappingBlockIds: string[];
}

export function createDefaultTodayPlanMetadata(): TodayPlanMetadata {
  return {
    version: 1,
    intention: "",
    mood: null,
    mood_reasons: [],
    mood_reason_note: "",
    outcomes: [],
    anchors: [],
    day_start: "08:00",
    day_end: "18:00",
    shutdown_time: "18:00",
    ritual_completed_at: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTime(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * The range a planned duration is kept inside.
 *
 * Exported so the field a user types into and the parser that reads it back
 * cannot drift apart: a value the form accepts but the parser clamps would
 * silently change after a reload.
 */
export const MIN_OUTCOME_MINUTES = 5;
export const MAX_OUTCOME_MINUTES = 240;

function boundedMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(
    MAX_OUTCOME_MINUTES,
    Math.max(MIN_OUTCOME_MINUTES, Math.round(value))
  );
}

function normalizeOutcome(value: unknown): TodayPlanOutcome | null {
  if (!isRecord(value)) return null;
  if (!OUTCOME_ROLES.includes(value.role as DayPlanOutcomeRole)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) return null;

  return {
    id:
      typeof value.id === "string" && value.id
        ? value.id
        : `outcome-${String(value.role)}`,
    role: value.role as DayPlanOutcomeRole,
    title: title.slice(0, 160),
    task_id: typeof value.task_id === "string" ? value.task_id : null,
    duration_minutes: boundedMinutes(value.duration_minutes, 60),
  };
}

function normalizeAnchor(value: unknown): TodayPlanAnchor | null {
  if (!isRecord(value)) return null;
  if (!SOURCE_TYPES.includes(value.source_type as DayPlanSourceType)) return null;
  if (value.source_type === "task") return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!title) return null;

  return {
    id:
      typeof value.id === "string" && value.id
        ? value.id
        : `anchor-${String(value.source_type)}-${title}`,
    source_type: value.source_type as TodayPlanAnchor["source_type"],
    source_id: typeof value.source_id === "string" ? value.source_id : null,
    title: title.slice(0, 160),
    emoji:
      typeof value.emoji === "string" && value.emoji.trim()
        ? value.emoji.trim().slice(0, 8)
        : "◆",
    duration_minutes: boundedMinutes(value.duration_minutes, 15),
  };
}

function normalizeMetadata(value: unknown): TodayPlanMetadata | null {
  if (!isRecord(value) || value.version !== 1) return null;

  const fallback = createDefaultTodayPlanMetadata();
  const dayStart = isTime(value.day_start) ? value.day_start : fallback.day_start;
  const dayEnd = isTime(value.day_end) ? value.day_end : fallback.day_end;
  // "" is the reminder switched off; only a missing or broken value falls
  // back to the end of the day, as plans from before the switch expect.
  const shutdown =
    value.shutdown_time === ""
      ? ""
      : isTime(value.shutdown_time)
        ? value.shutdown_time
        : dayEnd;
  const outcomes = Array.isArray(value.outcomes)
    ? value.outcomes
        .map(normalizeOutcome)
        .filter((item): item is TodayPlanOutcome => item !== null)
        .filter(
          (item, index, all) =>
            all.findIndex((candidate) => candidate.role === item.role) === index
        )
        .slice(0, 3)
    : [];
  const anchors = Array.isArray(value.anchors)
    ? value.anchors
        .map(normalizeAnchor)
        .filter((item): item is TodayPlanAnchor => item !== null)
        .slice(0, 20)
    : [];

  return {
    version: 1,
    intention:
      typeof value.intention === "string"
        ? value.intention.trim().slice(0, 500)
        : "",
    mood: isValidMoodValue(value.mood) ? value.mood : null,
    mood_reasons: normalizeMoodReasons(value.mood_reasons),
    mood_reason_note:
      typeof value.mood_reason_note === "string"
        ? value.mood_reason_note.trim().slice(0, MOOD_REASON_NOTE_MAX)
        : "",
    outcomes,
    anchors,
    day_start: dayStart,
    day_end: dayEnd,
    shutdown_time: shutdown,
    ritual_completed_at:
      typeof value.ritual_completed_at === "string"
        ? value.ritual_completed_at
        : null,
  };
}

export function parseTodayPlanNotes(
  notes: string | null | undefined
): ParsedTodayPlanNotes {
  if (!notes) return { metadata: null, legacyNotes: null };
  if (!notes.startsWith(TODAY_PLAN_NOTES_PREFIX)) {
    return { metadata: null, legacyNotes: notes };
  }

  try {
    const envelope = JSON.parse(
      notes.slice(TODAY_PLAN_NOTES_PREFIX.length)
    ) as unknown;
    if (!isRecord(envelope)) {
      return { metadata: null, legacyNotes: null };
    }

    return {
      metadata: normalizeMetadata(envelope.metadata),
      legacyNotes:
        typeof envelope.legacy_notes === "string"
          ? envelope.legacy_notes
          : null,
    };
  } catch {
    return { metadata: null, legacyNotes: null };
  }
}

export function serializeTodayPlanNotes(
  metadata: TodayPlanMetadata,
  legacyNotes: string | null = null
): string {
  return `${TODAY_PLAN_NOTES_PREFIX}${JSON.stringify({
    metadata: normalizeMetadata(metadata) ?? createDefaultTodayPlanMetadata(),
    legacy_notes: legacyNotes,
  })}`;
}

export function timeToMinutes(time: string): number {
  if (!isTime(time)) return Number.NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.min(23 * 60 + 59, Math.max(0, Math.round(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Moves an end time by the same offset as its paired start time, so nudging
 * when something starts doesn't silently shrink or inflate how long it runs.
 * One-directional by design: editing the end time never touches the start.
 */
export function shiftEndTime(
  previousStart: string,
  previousEnd: string,
  nextStart: string
): string {
  const previousStartMinutes = timeToMinutes(previousStart);
  const previousEndMinutes = timeToMinutes(previousEnd);
  const nextStartMinutes = timeToMinutes(nextStart);

  if (
    !Number.isFinite(previousStartMinutes) ||
    !Number.isFinite(previousEndMinutes) ||
    !Number.isFinite(nextStartMinutes)
  ) {
    return previousEnd;
  }

  const span = previousEndMinutes - previousStartMinutes;
  if (span <= 0) return previousEnd;

  return minutesToTime(nextStartMinutes + span);
}

function byStartTime(a: DayPlanBlock, b: DayPlanBlock) {
  return a.start_time.localeCompare(b.start_time);
}

/** Vertical pixels the timeline gives one minute. */
export const TIMELINE_PX_PER_MINUTE = 1.2;

/** Dragging resolves to this many minutes. */
export const TIMELINE_DRAG_GRID_MINUTES = 5;

/** The shortest a block may be dragged down to. */
export const MIN_BLOCK_MINUTES = 10;

/**
 * The span the timeline draws, in whole hours.
 *
 * Widened past the planned day whenever a block sits outside it, because a
 * block you cannot see is a block you cannot fix -- and the old form-based
 * step let people put one at 22:00 inside an 08:00-18:00 day.
 */
export function timelineWindow(
  blocks: DayPlanBlock[],
  dayStart: string,
  dayEnd: string
): { startMinutes: number; endMinutes: number } {
  const starts: number[] = [];
  const ends: number[] = [];

  const rawStart = timeToMinutes(dayStart);
  const rawEnd = timeToMinutes(dayEnd);
  if (Number.isFinite(rawStart)) starts.push(rawStart);
  if (Number.isFinite(rawEnd)) ends.push(rawEnd);

  for (const block of blocks) {
    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);
    if (Number.isFinite(start)) starts.push(start);
    if (Number.isFinite(end)) ends.push(end);
  }

  if (starts.length === 0 || ends.length === 0) {
    return { startMinutes: 8 * 60, endMinutes: 18 * 60 };
  }

  const startMinutes = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60);
  const endMinutes = Math.min(
    24 * 60,
    Math.ceil(Math.max(...ends, startMinutes + 60) / 60) * 60
  );
  return { startMinutes, endMinutes };
}

/** How long a block created by clicking empty time runs, when there is room. */
export const DEFAULT_NEW_BLOCK_MINUTES = 60;

export interface TimelineGap {
  startMinutes: number;
  endMinutes: number;
}

/**
 * The stretches of the day nothing is planned in.
 *
 * Only gaps at least MIN_BLOCK_MINUTES long are returned: a shorter one
 * cannot hold a valid block, so offering to fill it would be a dead end.
 * Overlapping blocks are walked as one occupied run rather than producing a
 * negative gap between them.
 */
export function findTimelineGaps(
  blocks: DayPlanBlock[],
  windowStart: number,
  windowEnd: number
): TimelineGap[] {
  const placed = blocks
    .map((block) => ({
      start: timeToMinutes(block.start_time),
      end: timeToMinutes(block.end_time),
    }))
    .filter(
      (span) =>
        Number.isFinite(span.start) &&
        Number.isFinite(span.end) &&
        span.end > span.start
    )
    .sort((a, b) => a.start - b.start);

  const gaps: TimelineGap[] = [];
  let cursor = windowStart;

  for (const span of placed) {
    if (span.start - cursor >= MIN_BLOCK_MINUTES) {
      gaps.push({ startMinutes: cursor, endMinutes: span.start });
    }
    cursor = Math.max(cursor, span.end);
  }

  if (windowEnd - cursor >= MIN_BLOCK_MINUTES) {
    gaps.push({ startMinutes: cursor, endMinutes: windowEnd });
  }

  return gaps;
}

/**
 * Where a block dropped into free time should begin and end.
 *
 * One hour, running from the full hour at or before the pointer to the full
 * hour after it -- 12:37 gives 12:00 to 13:00 -- so a block placed by hand
 * lands on the same round times a person would have picked.
 *
 * Both ends give way to what is already planned. When the whole hour does
 * not fit before the next block, the span slides back to end against it;
 * when the hour would start inside the previous block, it begins at that
 * block's end instead. A gap too narrow for an hour is filled exactly,
 * rather than being left with an unusable sliver on one side.
 */
export function blockSpanForGap(
  gap: TimelineGap,
  atMinutes: number
): { startMinutes: number; endMinutes: number } {
  const available = gap.endMinutes - gap.startMinutes;
  const duration = Math.min(DEFAULT_NEW_BLOCK_MINUTES, available);

  const onTheHour = Math.floor(atMinutes / 60) * 60;
  const startMinutes = Math.min(
    Math.max(onTheHour, gap.startMinutes),
    gap.endMinutes - duration
  );

  return { startMinutes, endMinutes: startMinutes + duration };
}

/**
 * Free time at least this long is folded into one labelled row.
 *
 * At 1.2px per minute an empty morning is a screen of blank hour lines
 * before the first thing planned. Shorter gaps stay at scale, since they are
 * the room between commitments that the axis exists to show.
 */
export const COMPRESS_FREE_MINUTES = 120;

/** How tall a folded stretch of free time is drawn, whatever its length. */
export const COLLAPSED_ROW_PX = 48;

/** One vertical run of the timeline: drawn at scale, or folded. */
export interface TimelineSegment {
  startMinutes: number;
  endMinutes: number;
  collapsed: boolean;
  /** Pixels from the top of the track. */
  top: number;
  height: number;
}

/**
 * Splits the drawn window into runs drawn at scale and folded free stretches.
 *
 * Only free time is ever folded, so every block keeps its true height and
 * its true distance to its neighbours. `isExpanded` receives a free
 * stretch's start minute and keeps that stretch at scale.
 */
export function timelineSegments(
  blocks: DayPlanBlock[],
  windowStart: number,
  windowEnd: number,
  isExpanded: (gapStart: number) => boolean = () => false
): TimelineSegment[] {
  const folded = findTimelineGaps(blocks, windowStart, windowEnd).filter(
    (gap) =>
      gap.endMinutes - gap.startMinutes >= COMPRESS_FREE_MINUTES &&
      !isExpanded(gap.startMinutes)
  );

  const segments: TimelineSegment[] = [];
  let cursor = windowStart;
  let top = 0;
  const push = (startMinutes: number, endMinutes: number, collapsed: boolean) => {
    if (endMinutes <= startMinutes) return;
    const height = collapsed
      ? COLLAPSED_ROW_PX
      : (endMinutes - startMinutes) * TIMELINE_PX_PER_MINUTE;
    segments.push({ startMinutes, endMinutes, collapsed, top, height });
    top += height;
  };

  for (const gap of folded) {
    push(cursor, gap.startMinutes, false);
    push(gap.startMinutes, gap.endMinutes, true);
    cursor = gap.endMinutes;
  }
  push(cursor, windowEnd, false);
  return segments;
}

/** Total drawn height of a set of segments. */
export function segmentsHeight(segments: TimelineSegment[]): number {
  const last = segments[segments.length - 1];
  return last ? last.top + last.height : 0;
}

/**
 * Where a minute is drawn. Inside a folded stretch the position is spread
 * evenly over the row, so a drag across it still moves continuously.
 */
export function offsetForMinute(
  segments: TimelineSegment[],
  minute: number
): number {
  if (segments.length === 0) return 0;
  const first = segments[0];
  if (minute <= first.startMinutes) {
    return first.top - (first.startMinutes - minute) * TIMELINE_PX_PER_MINUTE;
  }
  for (const segment of segments) {
    if (minute > segment.endMinutes) continue;
    const progress = minute - segment.startMinutes;
    return segment.collapsed
      ? segment.top +
          (progress / (segment.endMinutes - segment.startMinutes)) *
            segment.height
      : segment.top + progress * TIMELINE_PX_PER_MINUTE;
  }
  const last = segments[segments.length - 1];
  return (
    last.top +
    last.height +
    (minute - last.endMinutes) * TIMELINE_PX_PER_MINUTE
  );
}

/** The minute drawn at a pixel offset; the inverse of offsetForMinute. */
export function minuteForOffset(
  segments: TimelineSegment[],
  offset: number
): number {
  if (segments.length === 0) return 0;
  const first = segments[0];
  if (offset <= first.top) {
    return first.startMinutes - (first.top - offset) / TIMELINE_PX_PER_MINUTE;
  }
  for (const segment of segments) {
    if (offset > segment.top + segment.height) continue;
    const progress = offset - segment.top;
    return segment.collapsed
      ? segment.startMinutes +
          (progress / segment.height) *
            (segment.endMinutes - segment.startMinutes)
      : segment.startMinutes + progress / TIMELINE_PX_PER_MINUTE;
  }
  const last = segments[segments.length - 1];
  return (
    last.endMinutes +
    (offset - last.top - last.height) / TIMELINE_PX_PER_MINUTE
  );
}

/** Rounds a minute value to the drag grid. */
export function snapToDragGrid(minutes: number): number {
  return (
    Math.round(minutes / TIMELINE_DRAG_GRID_MINUTES) *
    TIMELINE_DRAG_GRID_MINUTES
  );
}

/**
 * Edits one block's times and carries everything after it along.
 *
 * Without this, moving the second of eight blocks leaves the other six
 * standing where they were, so the planner asks you to retype every later
 * time by hand -- and punishes the first overlap you create on the way. The
 * tail moves as a rigid chain: every duration and every gap after the edited
 * block is preserved exactly, including deliberate ones like a fixed lunch.
 *
 * Returns the blocks in their original array order, so React keys and the
 * rendered list stay stable.
 */
export function applyBlockTimeChange(
  blocks: DayPlanBlock[],
  id: string,
  patch: Pick<Partial<DayPlanBlock>, "start_time" | "end_time">
): DayPlanBlock[] {
  const target = blocks.find((block) => block.id === id);
  if (!target) return blocks;

  const edited = { ...target, ...patch };
  const previousEnd = timeToMinutes(target.end_time);
  const nextEnd = timeToMinutes(edited.end_time);
  const nextStart = timeToMinutes(edited.start_time);

  const applyEditOnly = () =>
    blocks.map((block) => (block.id === id ? edited : block));

  // A half-typed time ("1:" while reaching for 13:00) or an inverted span is
  // not something to ripple; leave it for findTodayPlanBlockProblems to flag.
  if (
    !Number.isFinite(previousEnd) ||
    !Number.isFinite(nextEnd) ||
    !Number.isFinite(nextStart) ||
    nextEnd <= nextStart
  ) {
    return applyEditOnly();
  }

  const delta = nextEnd - previousEnd;
  if (delta === 0) return applyEditOnly();

  const ordered = blocks.slice().sort(byStartTime);
  const targetIndex = ordered.findIndex((block) => block.id === id);
  const tail = ordered.slice(targetIndex + 1);
  if (tail.length === 0) return applyEditOnly();

  // Shift the whole tail by one clamped amount rather than per block, so the
  // chain cannot compress against the end of the day: the gaps a user can see
  // survive even when the day runs out of room.
  let shift = delta;
  if (shift > 0) {
    const latestEnd = tail.reduce(
      (latest, block) => Math.max(latest, timeToMinutes(block.end_time) || 0),
      0
    );
    shift = Math.min(shift, END_OF_DAY_MINUTES - latestEnd);
  } else {
    const earliestStart = tail.reduce(
      (earliest, block) =>
        Math.min(earliest, timeToMinutes(block.start_time) || 0),
      END_OF_DAY_MINUTES
    );
    shift = Math.max(shift, -earliestStart);
  }
  if (shift === 0) return applyEditOnly();

  const shiftedIds = new Set(tail.map((block) => block.id));
  return blocks.map((block) => {
    if (block.id === id) return edited;
    if (!shiftedIds.has(block.id)) return block;
    return {
      ...block,
      start_time: minutesToTime(timeToMinutes(block.start_time) + shift),
      end_time: minutesToTime(timeToMinutes(block.end_time) + shift),
    };
  });
}

/**
 * Pushes overlapping blocks apart, keeping their order and their durations.
 *
 * The planner used to detect an overlap and then simply refuse to move on,
 * leaving the user to solve it by arithmetic. Only blocks that actually
 * collide are moved, and only ever later, so a schedule that is already
 * clean comes back untouched.
 */
export function resolveOverlaps(blocks: DayPlanBlock[]): DayPlanBlock[] {
  const ordered = blocks.slice().sort(byStartTime);
  const resolved = new Map<string, DayPlanBlock>();
  let previousEnd: number | null = null;

  for (const block of ordered) {
    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);

    // An invalid block has no duration to preserve, so it cannot be placed;
    // it stays put and stays flagged.
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      resolved.set(block.id, block);
      continue;
    }

    if (previousEnd !== null && start < previousEnd) {
      const nextStart = nextGridStart(previousEnd);
      const duration = end - start;
      const nextEnd = Math.min(nextStart + duration, END_OF_DAY_MINUTES);
      resolved.set(block.id, {
        ...block,
        start_time: minutesToTime(nextStart),
        end_time: minutesToTime(nextEnd),
      });
      previousEnd = nextEnd;
      continue;
    }

    resolved.set(block.id, block);
    previousEnd = end;
  }

  return blocks.map((block) => resolved.get(block.id) ?? block);
}

export function blockDurationMinutes(block: DayPlanBlock): number {
  const start = timeToMinutes(block.start_time);
  const end = timeToMinutes(block.end_time);
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? end - start
    : 0;
}

/**
 * The minutes covered by valid blocks, merged into non-overlapping runs.
 *
 * Invalid blocks (unreadable or inverted times) cover nothing, the same way
 * blockDurationMinutes gives them no length.
 */
export function occupiedSpans(
  blocks: DayPlanBlock[]
): { startMinutes: number; endMinutes: number }[] {
  const spans = blocks
    .filter((block) => blockDurationMinutes(block) > 0)
    .map((block) => ({
      startMinutes: timeToMinutes(block.start_time),
      endMinutes: timeToMinutes(block.end_time),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const merged: { startMinutes: number; endMinutes: number }[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, span.endMinutes);
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

/**
 * How much of the day is planned, and how much is left.
 *
 * Counts real time blocks only: a habit kept flexible or the day-end
 * reminder reserve no time and never appear here. Overlaps count once, and
 * whatever lies outside the day hours is reported apart rather than eating
 * into the unplanned time inside them.
 */
export function calculateTodayPlanCapacity(
  blocks: DayPlanBlock[],
  dayStart: string,
  dayEnd: string
): TodayPlanCapacity {
  const start = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);
  const validDay = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const availableMinutes = validDay ? end - start : 0;

  let plannedMinutes = 0;
  let insideMinutes = 0;
  for (const span of occupiedSpans(blocks)) {
    plannedMinutes += span.endMinutes - span.startMinutes;
    if (validDay) {
      insideMinutes += Math.max(
        0,
        Math.min(span.endMinutes, end) - Math.max(span.startMinutes, start)
      );
    }
  }
  const outsideMinutes = plannedMinutes - insideMinutes;
  const remainingMinutes = availableMinutes - insideMinutes;
  const utilizationPercent =
    availableMinutes > 0
      ? Math.round((insideMinutes / availableMinutes) * 100)
      : 0;

  let status: TodayPlanCapacity["status"] = "open";
  if (outsideMinutes > 0) status = "over";
  else if (utilizationPercent >= 90) status = "full";
  else if (utilizationPercent >= 65) status = "balanced";

  return {
    availableMinutes,
    plannedMinutes,
    outsideMinutes,
    remainingMinutes,
    utilizationPercent,
    status,
  };
}

/**
 * Valid blocks that start before the day does or end after it.
 *
 * Changing the day hours never moves or deletes a block; these are the ones
 * the timeline then marks, so the change stays visible.
 */
export function blocksOutsideDay(
  blocks: DayPlanBlock[],
  dayStart: string,
  dayEnd: string
): DayPlanBlock[] {
  const start = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
  return blocks
    .filter((block) => blockDurationMinutes(block) > 0)
    .filter(
      (block) =>
        timeToMinutes(block.start_time) < start ||
        timeToMinutes(block.end_time) > end
    )
    .sort(byStartTime);
}

/** Valid blocks, other than `exceptId`, that share minutes with a span. */
export function blocksOverlapping(
  blocks: DayPlanBlock[],
  startMinutes: number,
  endMinutes: number,
  exceptId?: string
): DayPlanBlock[] {
  return blocks
    .filter((block) => block.id !== exceptId && blockDurationMinutes(block) > 0)
    .filter(
      (block) =>
        timeToMinutes(block.start_time) < endMinutes &&
        timeToMinutes(block.end_time) > startMinutes
    )
    .sort(byStartTime);
}

/**
 * The first minute at or after `fromMinutes` where `duration` fits without
 * touching a block, or null when nothing fits before the end of the day.
 */
export function firstFreeStart(
  blocks: DayPlanBlock[],
  fromMinutes: number,
  duration: number
): number | null {
  let cursor = Math.max(0, fromMinutes);
  for (const span of occupiedSpans(blocks)) {
    if (span.endMinutes <= cursor) continue;
    if (span.startMinutes >= cursor + duration) break;
    cursor = span.endMinutes;
  }
  return cursor + duration <= END_OF_DAY_MINUTES ? cursor : null;
}

/** A block another one pushed along, and by how many minutes. */
export interface RippledBlock {
  block: DayPlanBlock;
  shiftMinutes: number;
}

/**
 * Which blocks, other than the edited one, moved between two versions of
 * the day. Used to say what a time change carries along before it is made.
 */
export function describeRipple(
  before: DayPlanBlock[],
  after: DayPlanBlock[],
  editedId: string
): RippledBlock[] {
  const previous = new Map(before.map((block) => [block.id, block]));
  return after
    .filter((block) => block.id !== editedId)
    .flatMap((block) => {
      const old = previous.get(block.id);
      if (!old || old.start_time === block.start_time) return [];
      return [
        {
          block,
          shiftMinutes:
            timeToMinutes(block.start_time) - timeToMinutes(old.start_time),
        },
      ];
    })
    .sort((a, b) => byStartTime(a.block, b.block));
}

export function findTodayPlanBlockProblems(
  blocks: DayPlanBlock[]
): TodayPlanBlockProblems {
  const invalidBlockIds = blocks
    .filter((block) => blockDurationMinutes(block) <= 0 || !block.title.trim())
    .map((block) => block.id);
  const overlapping = new Set<string>();
  const valid = blocks
    .filter((block) => !invalidBlockIds.includes(block.id))
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (let index = 1; index < valid.length; index += 1) {
    const previous = valid[index - 1];
    const current = valid[index];
    if (timeToMinutes(current.start_time) < timeToMinutes(previous.end_time)) {
      overlapping.add(previous.id);
      overlapping.add(current.id);
    }
  }

  return {
    invalidBlockIds,
    overlappingBlockIds: Array.from(overlapping),
  };
}

function outcomeMission(role: DayPlanOutcomeRole): {
  category: DayPlanCategory;
  missionType: DayPlanMissionType;
} {
  if (role === "must_win") {
    return { category: "deep_work", missionType: "main_quest" };
  }
  if (role === "health") {
    return { category: "personal", missionType: "recovery" };
  }
  return { category: "deep_work", missionType: "side_quest" };
}

/**
 * Whether an anchor always occupies the clock.
 *
 * A workout genuinely takes an hour of the day and belongs on the timeline.
 * A habit or a journal prompt does not by default: giving "Smile 5 times a
 * day" a slot from 12:10 to 12:25 invents a meeting that will never happen.
 * Those stay flexible unless the user reserves a block for them
 * (reserveAnchorBlock); either way they live in metadata.anchors.
 */
export function anchorTakesTime(anchor: TodayPlanAnchor): boolean {
  return anchor.source_type === "workout";
}

function anchorCategory(
  sourceType: TodayPlanAnchor["source_type"]
): DayPlanCategory {
  if (sourceType === "workout") return "exercise";
  if (sourceType === "journal") return "personal";
  return "other";
}

/**
 * The block an anchor reserved, if any.
 *
 * Matched on the record it points at (`source_type` and `source_id`), never
 * on the title, so renaming a block cannot detach it and a habit cannot end
 * up with two blocks.
 */
export function blockForAnchor(
  blocks: DayPlanBlock[],
  anchor: TodayPlanAnchor
): DayPlanBlock | undefined {
  const key = anchor.source_id ?? anchor.id;
  return blocks.find(
    (block) =>
      block.source_type === anchor.source_type && block.source_id === key
  );
}

/**
 * Habits and reflections chosen for today without a time block.
 *
 * Training always takes time, so it never shows up here even before its
 * block has been built.
 */
export function flexibleAnchors(
  metadata: TodayPlanMetadata,
  blocks: DayPlanBlock[]
): TodayPlanAnchor[] {
  return metadata.anchors.filter(
    (anchor) => !anchorTakesTime(anchor) && !blockForAnchor(blocks, anchor)
  );
}

interface PlanState {
  metadata: TodayPlanMetadata;
  blocks: DayPlanBlock[];
}

function withAnchor(
  metadata: TodayPlanMetadata,
  anchor: TodayPlanAnchor
): TodayPlanMetadata {
  return metadata.anchors.some((item) => item.id === anchor.id)
    ? metadata
    : { ...metadata, anchors: [...metadata.anchors, anchor] };
}

/**
 * Plans an anchor into a time block, once.
 *
 * Confirming twice, or reserving a habit that already has a block, retimes
 * the existing block instead of adding a second one. The anchor itself is
 * recorded once as well.
 */
export function reserveAnchorBlock(
  state: PlanState,
  anchor: TodayPlanAnchor,
  startTime: string,
  endTime: string,
  idFactory: () => string = defaultId
): PlanState {
  const metadata = withAnchor(state.metadata, anchor);
  const existing = blockForAnchor(state.blocks, anchor);
  if (existing) {
    return {
      metadata,
      blocks: state.blocks.map((block) =>
        block.id === existing.id
          ? { ...block, start_time: startTime, end_time: endTime }
          : block
      ),
    };
  }
  return {
    metadata,
    blocks: [
      ...state.blocks,
      {
        id: idFactory(),
        start_time: startTime,
        end_time: endTime,
        title: anchor.title,
        category: anchorCategory(anchor.source_type),
        mission_type: "anchor",
        source_type: anchor.source_type,
        source_id: anchor.source_id ?? anchor.id,
      },
    ],
  };
}

/**
 * Keeps an anchor in today's plan without reserving time for it.
 *
 * Turning a reserved habit back into a flexible one drops only its block.
 */
export function keepAnchorFlexible(
  state: PlanState,
  anchor: TodayPlanAnchor
): PlanState {
  const block = blockForAnchor(state.blocks, anchor);
  return {
    metadata: withAnchor(state.metadata, anchor),
    blocks: block
      ? state.blocks.filter((item) => item.id !== block.id)
      : state.blocks,
  };
}

/**
 * Takes an anchor out of today's plan, with its block if it had one.
 *
 * Only the plan changes: the habit or journal template and its history are
 * separate records and stay as they are.
 */
export function removeAnchorFromPlan(
  state: PlanState,
  anchor: TodayPlanAnchor
): PlanState {
  const block = blockForAnchor(state.blocks, anchor);
  return {
    metadata: {
      ...state.metadata,
      anchors: state.metadata.anchors.filter((item) => item.id !== anchor.id),
    },
    blocks: block
      ? state.blocks.filter((item) => item.id !== block.id)
      : state.blocks,
  };
}

/**
 * An id for a new plan block.
 *
 * Guarded because crypto.randomUUID is absent in some test environments and
 * in older browsers, where an unguarded call throws while adding a block.
 */
export function planBlockId(): string {
  return defaultId();
}

function defaultId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildTodayPlanSchedule({
  blocks,
  metadata,
  idFactory = defaultId,
}: {
  blocks: DayPlanBlock[];
  metadata: TodayPlanMetadata;
  idFactory?: () => string;
}): DayPlanBlock[] {
  // A priority's block follows the priority. Going back to swap the main
  // focus for another task used to leave the old task's block on the
  // timeline, still claiming to be the main focus; removing a priority left
  // its block behind. The block keeps its times either way.
  const chosen = metadata.outcomes.filter((outcome) => outcome.title.trim());
  const next = blocks.flatMap((block) => {
    if (!block.outcome_role) return [{ ...block }];
    const outcome = chosen.find((item) => item.role === block.outcome_role);
    if (!outcome) return [];
    return [
      {
        ...block,
        title: outcome.title,
        source_type: outcome.task_id ? ("task" as const) : ("manual" as const),
        source_id: outcome.task_id ?? outcome.id,
      },
    ];
  });
  const dayStart = timeToMinutes(metadata.day_start) || 8 * 60;
  const latestEnd = next.reduce(
    (latest, block) =>
      Math.max(latest, timeToMinutes(block.end_time) || 0),
    dayStart
  );
  // The first generated block may begin exactly when the day does; anything
  // after an existing block needs the transition gap and the grid.
  let cursor = next.length > 0 ? nextGridStart(latestEnd) : dayStart;

  function append(
    title: string,
    duration: number,
    details: Pick<
      DayPlanBlock,
      "category" | "mission_type" | "source_type" | "source_id" | "outcome_role"
    >
  ) {
    const end = Math.min(cursor + duration, END_OF_DAY_MINUTES);
    if (end <= cursor) return;
    next.push({
      id: idFactory(),
      start_time: minutesToTime(cursor),
      end_time: minutesToTime(end),
      title,
      ...details,
    });
    cursor = nextGridStart(end);
  }

  for (const outcome of metadata.outcomes) {
    if (!outcome.title.trim()) continue;
    if (next.some((block) => block.outcome_role === outcome.role)) continue;
    const mission = outcomeMission(outcome.role);
    append(outcome.title, outcome.duration_minutes, {
      category: mission.category,
      mission_type: mission.missionType,
      source_type: outcome.task_id ? "task" : "manual",
      source_id: outcome.task_id ?? outcome.id,
      outcome_role: outcome.role,
    });
  }

  for (const anchor of metadata.anchors) {
    if (!anchorTakesTime(anchor)) continue;
    // Match the identity `append` actually writes below. Falling back to the
    // title instead would never match an anchor without a source_id, because
    // the block's title carries the emoji and the anchor's does not -- which
    // duplicated the workout block every time the schedule was rebuilt.
    const anchorKey = anchor.source_id ?? anchor.id;
    const alreadyScheduled = next.some(
      (block) =>
        block.source_type === anchor.source_type &&
        block.source_id === anchorKey
    );
    if (alreadyScheduled) continue;
    append(`${anchor.emoji} ${anchor.title}`.trim(), anchor.duration_minutes, {
      category: anchorCategory(anchor.source_type),
      mission_type: "anchor",
      source_type: anchor.source_type,
      source_id: anchor.source_id ?? anchor.id,
      outcome_role: undefined,
    });
  }

  return next.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * A task's due date in words, relative to the day being planned.
 *
 * Shown beside a task while it is being chosen for today, so the two dates
 * stay visibly separate: choosing a task for today plans it, and never
 * changes when it is due. Null for a task without a due date.
 */
export function describeTaskDue(
  dueDate: string | null,
  today: string
): string | null {
  if (!dueDate) return null;
  if (dueDate === today) return "Due today";
  if (dueDate === addDays(today, 1)) return "Due tomorrow";
  const label = formatDateOnly(dueDate, { month: "short", day: "numeric" });
  return dueDate < today ? `Overdue since ${label}` : `Due ${label}`;
}

export function formatPlanMinutes(minutes: number): string {
  const absolute = Math.abs(Math.round(minutes));
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

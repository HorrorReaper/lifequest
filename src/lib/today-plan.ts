import type {
  DayPlanBlock,
  DayPlanCategory,
  DayPlanMissionType,
  DayPlanOutcomeRole,
  DayPlanSourceType,
} from "@/lib/types";
import { isValidMoodValue } from "@/lib/mood";

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
  outcomes: TodayPlanOutcome[];
  anchors: TodayPlanAnchor[];
  day_start: string;
  day_end: string;
  shutdown_time: string;
  ritual_completed_at: string | null;
}

export interface ParsedTodayPlanNotes {
  metadata: TodayPlanMetadata | null;
  legacyNotes: string | null;
}

export interface TodayPlanCapacity {
  availableMinutes: number;
  plannedMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
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

function boundedMinutes(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(240, Math.max(5, Math.round(value)));
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
  const shutdown = isTime(value.shutdown_time)
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

export function calculateTodayPlanCapacity(
  blocks: DayPlanBlock[],
  dayStart: string,
  dayEnd: string
): TodayPlanCapacity {
  const start = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);
  const availableMinutes =
    Number.isFinite(start) && Number.isFinite(end) && end > start
      ? end - start
      : 0;
  const plannedMinutes = blocks.reduce(
    (sum, block) => sum + blockDurationMinutes(block),
    0
  );
  const remainingMinutes = availableMinutes - plannedMinutes;
  const utilizationPercent =
    availableMinutes > 0
      ? Math.round((plannedMinutes / availableMinutes) * 100)
      : plannedMinutes > 0
        ? 100
        : 0;

  let status: TodayPlanCapacity["status"] = "open";
  if (remainingMinutes < 0) status = "over";
  else if (utilizationPercent >= 90) status = "full";
  else if (utilizationPercent >= 65) status = "balanced";

  return {
    availableMinutes,
    plannedMinutes,
    remainingMinutes,
    utilizationPercent,
    status,
  };
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
 * Whether an anchor is a commitment that occupies the clock.
 *
 * A workout genuinely takes an hour of the day and belongs on the timeline.
 * A habit or a journal prompt does not: giving "Smile 5 times a day" a slot
 * from 12:10 to 12:25 invents a meeting that will never happen, and pushes
 * everything real later. Those ride along with the day as a checklist
 * instead -- they still live in metadata.anchors, they just never become
 * blocks.
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
  const next = blocks.map((block) => ({ ...block }));
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

export function formatPlanMinutes(minutes: number): string {
  const absolute = Math.abs(Math.round(minutes));
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

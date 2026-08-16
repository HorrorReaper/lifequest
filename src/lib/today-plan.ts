import type {
  DayPlanBlock,
  DayPlanCategory,
  DayPlanMissionType,
  DayPlanOutcomeRole,
  DayPlanSourceType,
} from "@/lib/types";
import { isValidMoodValue } from "@/lib/mood";

export const TODAY_PLAN_NOTES_PREFIX = "LIFEQUEST_TODAY_PLAN_V1:";

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
  /** How the user said they felt when starting today's ritual; one of the shared mood vocabulary values, or null if skipped. */
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
  const latestEnd = next.reduce(
    (latest, block) =>
      Math.max(latest, timeToMinutes(block.end_time) || 0),
    timeToMinutes(metadata.day_start) || 8 * 60
  );
  let cursor = Math.min(
    latestEnd + (next.length > 0 ? 10 : 0),
    23 * 60
  );

  function append(
    title: string,
    duration: number,
    details: Pick<
      DayPlanBlock,
      "category" | "mission_type" | "source_type" | "source_id" | "outcome_role"
    >
  ) {
    const end = Math.min(cursor + duration, 23 * 60 + 59);
    if (end <= cursor) return;
    next.push({
      id: idFactory(),
      start_time: minutesToTime(cursor),
      end_time: minutesToTime(end),
      title,
      ...details,
    });
    cursor = Math.min(end + 10, 23 * 60 + 59);
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
    const alreadyScheduled = next.some(
      (block) =>
        block.source_type === anchor.source_type &&
        (anchor.source_id
          ? block.source_id === anchor.source_id
          : block.title === anchor.title)
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

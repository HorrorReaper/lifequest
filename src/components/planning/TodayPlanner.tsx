"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { upsertDayPlan } from "@/lib/day-plans";
import { createTask } from "@/lib/tasks";
import { MoodSelector } from "@/components/journal/mood-selector";
import { DEFAULT_MOOD_OPTIONS } from "@/lib/mood";
import {
  MOOD_REASON_NOTE_MAX,
  MOOD_REASONS,
} from "@/lib/mood-reasons";
import { TodayPriorities } from "@/components/planning/TodayPriorities";
import { PlanTimeline } from "@/components/planning/PlanTimeline";
import { DayFrameBar } from "@/components/planning/DayFrameBar";
import { PlanCapacityLine } from "@/components/planning/PlanCapacityLine";
import { AlsoToday } from "@/components/planning/AlsoToday";
import {
  AddToDayDialog,
  type AddEntry,
  type AddRequest,
} from "@/components/planning/AddToDayDialog";
import {
  BlockEditorDialog,
  PRIORITY_LABELS,
} from "@/components/planning/BlockEditorDialog";
import {
  earlierStep,
  furthestStepFor,
  PLANNER_STEP_IDS,
  resolvePlannerStep,
  type PlannerStepId,
} from "@/components/planning/planner-steps";
import type {
  DayPlanBlock,
  DayPlanCategory,
  DayPlanOutcomeRole,
} from "@/lib/types";
import {
  anchorTakesTime,
  blockForAnchor,
  buildTodayPlanSchedule,
  calculateTodayPlanCapacity,
  createDefaultTodayPlanMetadata,
  findTodayPlanBlockProblems,
  flexibleAnchors,
  keepAnchorFlexible,
  occupiedSpans,
  parseTodayPlanNotes,
  planBlockId,
  removeAnchorFromPlan,
  reserveAnchorBlock,
  resolveOverlaps,
  serializeTodayPlanNotes,
  timeToMinutes,
  type TodayPlanAnchor,
  type TodayPlanMetadata,
  type TodayPlanOutcome,
} from "@/lib/today-plan";
import { cn } from "@/lib/utils";

export interface TodayPlannerTask {
  id: string;
  title: string;
  dueDate: string | null;
  priority: "low" | "medium" | "high";
  isOverdue: boolean;
  estimateMinutes: number | null;
}

export interface TodayPlannerHabit {
  id: string;
  name: string;
  emoji: string;
  completedToday: boolean;
}

export interface TodayPlannerJournal {
  id: string;
  name: string;
  icon: string;
  completedToday: boolean;
  /** A built-in template rather than one the user made or copied. */
  isSystem?: boolean;
}

interface TodayPlannerProps {
  userId: string;
  date: string;
  dateLabel: string;
  initialBlocks: DayPlanBlock[];
  initialNotes: string | null;
  tasks: TodayPlannerTask[];
  habits: TodayPlannerHabit[];
  journals: TodayPlannerJournal[];
  workoutsEnabled: boolean;
  /**
   * Opens the plan editor on the timeline instead of the six-step ritual.
   *
   * Set by the route when there is already a plan to edit; walking someone
   * through mood and priorities again to move one block is the reason this
   * exists. In this mode the footer saves the plan directly, and the full
   * ritual stays one link away.
   */
  startAt?: PlannerEntryPoint;
  /** Embed the same planner inside Work without a second main landmark. */
  embedded?: boolean;
  returnHref?: string;
}

interface PlannerDraft {
  metadata: TodayPlanMetadata;
  blocks: DayPlanBlock[];
}

/** What sessionStorage holds: the plan, and the step it was left on. */
interface StoredDraft extends PlannerDraft {
  step: PlannerStepId | null;
}

const STEP_COPY: Record<
  PlannerStepId,
  { label: string; title: string; description: string }
> = {
  mood: {
    label: "Mood",
    title: "How are you feeling right now?",
    description: "Name it before you plan around it. One tap is enough.",
  },
  intention: {
    label: "Intention",
    title: "What quality should guide today?",
    description: "A short line you can hold every later tradeoff against.",
  },
  priorities: {
    label: "Priorities",
    title: "What matters most today?",
    description: "Choose one focus. Add one more if there’s room.",
  },
  timeline: {
    label: "Shape your day",
    title: "Make room for your day",
    description:
      "Your priorities on the clock, with habits, reflection and breaks around them.",
  },
  review: {
    label: "Review",
    title: "Review and save your plan",
    description: "Check the time you scheduled, fix any conflicts, then save.",
  },
};

const STEPS = PLANNER_STEP_IDS.map((id) => ({ id, ...STEP_COPY[id] }));

/**
 * Where each step sits in STEPS.
 *
 * Steps have been inserted into and taken out of this flow; naming them
 * keeps every check below to the step it means rather than a number.
 */
const MOOD_STEP = PLANNER_STEP_IDS.indexOf("mood");
const INTENTION_STEP = PLANNER_STEP_IDS.indexOf("intention");
const OUTCOMES_STEP = PLANNER_STEP_IDS.indexOf("priorities");
const TIMELINE_STEP = PLANNER_STEP_IDS.indexOf("timeline");
const COMMIT_STEP = PLANNER_STEP_IDS.indexOf("review");

/** Where the planner may be asked to open, via ?step= on the route. */
export type PlannerEntryPoint = "timeline";

/**
 * How long a priority's block runs before anyone sets a length.
 *
 * The roles are named once, in PRIORITY_LABELS ("Main focus", "Second
 * task", "Recharge"), so the timeline, the block editor and the review step
 * call them the same thing.
 */
const OUTCOME_META: Record<DayPlanOutcomeRole, { defaultDuration: number }> = {
  must_win: { defaultDuration: 90 },
  progress: { defaultDuration: 60 },
  health: { defaultDuration: 45 },
};

/**
 * Journal names as the anchor list shows them.
 *
 * A copied template keeps its original's name, so two "Weekly Review" rows
 * could not be told apart. Only names that occur more than once get a note,
 * saying which one is the built-in template and which is the user's own.
 */
export function journalAnchorTitles(
  journals: readonly Pick<TodayPlannerJournal, "id" | "name" | "isSystem">[]
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const journal of journals) {
    const key = journal.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const titles = new Map<string, string>();
  const seen = new Map<string, number>();
  for (const journal of journals) {
    const key = journal.name.trim().toLowerCase();
    if ((counts.get(key) ?? 0) < 2) {
      titles.set(journal.id, journal.name);
      continue;
    }
    if (journal.isSystem) {
      titles.set(journal.id, `${journal.name} (standard)`);
      continue;
    }
    const index = (seen.get(key) ?? 0) + 1;
    seen.set(key, index);
    const ownCount = journals.filter(
      (item) => !item.isSystem && item.name.trim().toLowerCase() === key
    ).length;
    titles.set(
      journal.id,
      ownCount > 1 ? `${journal.name} (your copy ${index})` : `${journal.name} (your copy)`
    );
  }
  return titles;
}

function fingerprint(value: PlannerDraft) {
  return JSON.stringify(value);
}

function draftKey(userId: string, date: string) {
  return `lifequest:today-plan:${userId}:${date}`;
}

/**
 * Reads a draft back from sessionStorage.
 *
 * Drafts from before the anchors step was folded into the timeline carry no
 * step, or an index into the old six steps; resolvePlannerStep maps both.
 */
export function normalizeDraft(value: unknown): StoredDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PlannerDraft> & { step?: unknown };
  if (!Array.isArray(candidate.blocks) || !candidate.metadata) return null;

  const metadata = parseTodayPlanNotes(
    serializeTodayPlanNotes(candidate.metadata)
  ).metadata;
  const blocks = candidate.blocks.filter((block): block is DayPlanBlock => {
    if (typeof block !== "object" || block === null) return false;
    const item = block as Partial<DayPlanBlock>;
    return (
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      typeof item.start_time === "string" &&
      typeof item.end_time === "string" &&
      typeof item.category === "string"
    );
  });

  return metadata
    ? { metadata, blocks, step: resolvePlannerStep(candidate.step) }
    : null;
}

function roleOutcome(
  metadata: TodayPlanMetadata,
  role: DayPlanOutcomeRole
) {
  return metadata.outcomes.find((outcome) => outcome.role === role) ?? null;
}

/** The block for a task added from "Add to your day", or a plain-text one. */
function taskBlock(
  entry: Extract<AddEntry, { kind: "task" }>
): DayPlanBlock {
  return {
    id: planBlockId(),
    start_time: entry.startTime,
    end_time: entry.endTime,
    title: entry.title,
    category: "deep_work" as DayPlanCategory,
    mission_type: "side_quest",
    source_type: entry.task ? "task" : "manual",
    source_id: entry.task?.id ?? null,
  };
}

export function TodayPlanner({
  userId,
  date,
  dateLabel,
  initialBlocks,
  initialNotes,
  tasks,
  habits,
  journals,
  workoutsEnabled,
  startAt,
  embedded = false,
  returnHref = "/dashboard",
}: TodayPlannerProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const parsedNotes = useMemo(
    () => parseTodayPlanNotes(initialNotes),
    [initialNotes]
  );
  const initialMetadata = useMemo(
    () => parsedNotes.metadata ?? createDefaultTodayPlanMetadata(),
    [parsedNotes.metadata]
  );
  const initialFingerprint = useRef(
    fingerprint({ metadata: initialMetadata, blocks: initialBlocks })
  );
  const [metadata, setMetadata] =
    useState<TodayPlanMetadata>(initialMetadata);
  const [blocks, setBlocks] = useState<DayPlanBlock[]>(initialBlocks);
  const [step, setStep] = useState(
    startAt === "timeline" ? TIMELINE_STEP : MOOD_STEP
  );
  // Editing an existing plan: the timeline with a Save button, no steps.
  const editMode = startAt === "timeline";
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Seeded from the server-loaded prop, then grown locally so a task created
  // inline from any outcome's combobox shows up immediately in the other
  // two comboboxes without a round trip back to the server.
  const [taskList, setTaskList] = useState<TodayPlannerTask[]>(tasks);
  const [creatingRole, setCreatingRole] = useState<DayPlanOutcomeRole | null>(
    null
  );
  const [createTaskError, setCreateTaskError] = useState<{
    role: DayPlanOutcomeRole;
    message: string;
  } | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // State lags a render behind a second tap on Save; the ref does not, so a
  // double tap cannot send the plan twice.
  const savingRef = useRef(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addRequest, setAddRequest] = useState<AddRequest>({});
  const [creatingTask, setCreatingTask] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);

  const currentDraft = useMemo(
    () => ({ metadata, blocks }),
    [blocks, metadata]
  );
  const isDirty = fingerprint(currentDraft) !== initialFingerprint.current;
  const mainOutcome = roleOutcome(metadata, "must_win");
  const capacity = calculateTodayPlanCapacity(
    blocks,
    metadata.day_start,
    metadata.day_end
  );
  const problems = findTodayPlanBlockProblems(blocks);
  const canCommit =
    Boolean(mainOutcome?.title.trim()) &&
    problems.invalidBlockIds.length === 0 &&
    problems.overlappingBlockIds.length === 0 &&
    !saving;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(draftKey(userId, date));
      if (stored) {
        const recovered = normalizeDraft(JSON.parse(stored));
        if (recovered) {
          setMetadata(recovered.metadata);
          setBlocks(recovered.blocks);
          setRestoredDraft(true);
          // Back where it was left, but never past a step whose answer
          // the draft is missing. The editor has no steps to return to.
          if (!editMode) {
            const resumeAt = earlierStep(
              recovered.step ?? "mood",
              furthestStepFor(recovered.metadata)
            );
            setStep(PLANNER_STEP_IDS.indexOf(resumeAt));
          }
        } else {
          sessionStorage.removeItem(draftKey(userId, date));
        }
      }
    } catch {
      sessionStorage.removeItem(draftKey(userId, date));
    } finally {
      setDraftReady(true);
    }
    // Restores once per user and day; editMode is fixed for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, userId]);

  const stepId = PLANNER_STEP_IDS[step];
  useEffect(() => {
    if (!draftReady) return;
    if (!isDirty) {
      sessionStorage.removeItem(draftKey(userId, date));
      return;
    }
    const stored: StoredDraft = { ...currentDraft, step: stepId };
    sessionStorage.setItem(draftKey(userId, date), JSON.stringify(stored));
  }, [currentDraft, date, draftReady, isDirty, stepId, userId]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  function updateMetadata(patch: Partial<TodayPlanMetadata>) {
    setMetadata((current) => ({ ...current, ...patch }));
    setStepError(null);
  }

  function toggleMoodReason(id: string) {
    setMetadata((current) => ({
      ...current,
      mood_reasons: current.mood_reasons.includes(id)
        ? current.mood_reasons.filter((item) => item !== id)
        : [...current.mood_reasons, id],
    }));
    setStepError(null);
  }

  function updateOutcome(
    role: DayPlanOutcomeRole,
    patch: Partial<TodayPlanOutcome>
  ) {
    setMetadata((current) => {
      const existing = roleOutcome(current, role) ?? {
        id: `outcome-${role}`,
        role,
        title: "",
        task_id: null,
        duration_minutes: OUTCOME_META[role].defaultDuration,
      };
      const next = { ...existing, ...patch, role };
      return {
        ...current,
        outcomes: [
          ...current.outcomes.filter((outcome) => outcome.role !== role),
          next,
        ],
      };
    });
    setStepError(null);
  }

  function removeOutcome(role: DayPlanOutcomeRole) {
    setMetadata((current) => ({
      ...current,
      outcomes: current.outcomes.filter((outcome) => outcome.role !== role),
    }));
    setStepError(null);
  }

  /**
   * Links a task to a role for today.
   *
   * Only the plan changes: the task's own record, its due date included, is
   * not touched, since planning a task into today is not the same as making
   * it due today. A task already holding another role is refused, so one
   * task cannot be both the main focus and the second task.
   */
  function assignTaskToRole(role: DayPlanOutcomeRole, task: TodayPlannerTask) {
    if (
      metadata.outcomes.some(
        (outcome) => outcome.role !== role && outcome.task_id === task.id
      )
    ) {
      return;
    }
    updateOutcome(role, {
      title: task.title,
      task_id: task.id,
      duration_minutes:
        task.estimateMinutes ?? OUTCOME_META[role].defaultDuration,
    });
  }

  /**
   * Creates a real task from a title, with no due date.
   *
   * Shared by the priority picker and "Add to your day". Resolves null when
   * the insert failed, so the caller keeps its dialog and the typed title.
   */
  async function createPlannerTask(
    title: string
  ): Promise<TodayPlannerTask | null> {
    const trimmed = title.trim();
    if (!trimmed) return null;
    try {
      const created = await createTask(supabase, userId, { title: trimmed });
      const plannerTask: TodayPlannerTask = {
        id: created.id,
        title: created.title,
        dueDate: created.due_date,
        priority: created.priority,
        isOverdue: false,
        estimateMinutes: null,
      };
      setTaskList((current) => [plannerTask, ...current]);
      return plannerTask;
    } catch (error) {
      console.error("Failed to create task from Today Plan", error);
      return null;
    }
  }

  async function createAndAssignTask(
    role: DayPlanOutcomeRole,
    title: string
  ): Promise<boolean> {
    if (!title.trim() || creatingRole) return false;

    setCreatingRole(role);
    setCreateTaskError(null);
    try {
      const created = await createPlannerTask(title);
      if (!created) {
        setCreateTaskError({
          role,
          message: "Could not create the task. Please try again.",
        });
        return false;
      }
      assignTaskToRole(role, created);
      return true;
    } finally {
      setCreatingRole(null);
    }
  }

  async function createTaskForDay(
    title: string
  ): Promise<TodayPlannerTask | null> {
    if (creatingTask) return null;
    setCreatingTask(true);
    setAddTaskError(null);
    try {
      const created = await createPlannerTask(title);
      if (!created) {
        setAddTaskError("Could not create the task. Please try again.");
      }
      return created;
    } finally {
      setCreatingTask(false);
    }
  }

  function openAdd(request: AddRequest = {}) {
    setAddRequest(request);
    setAddTaskError(null);
    setAddOpen(true);
  }

  /**
   * Puts what "Add to your day" returned into the plan.
   *
   * Each path is safe to repeat: a task already on the timeline is retimed
   * rather than added twice, and habits and reflections go through
   * reserveAnchorBlock and keepAnchorFlexible, which never duplicate.
   */
  function addToDay(entry: AddEntry) {
    setStepError(null);
    if (entry.kind === "anchor") {
      const state = { metadata, blocks };
      const next =
        entry.mode === "flexible"
          ? keepAnchorFlexible(state, entry.anchor)
          : reserveAnchorBlock(
              state,
              entry.anchor,
              entry.startTime,
              entry.endTime
            );
      setMetadata(next.metadata);
      setBlocks(next.blocks);
      return;
    }

    if (entry.kind === "break") {
      setBlocks((current) => [
        ...current,
        {
          id: planBlockId(),
          start_time: entry.startTime,
          end_time: entry.endTime,
          title: entry.title,
          category: "break",
          mission_type: "recovery",
          source_type: "manual",
          source_id: null,
        },
      ]);
      return;
    }

    // A general block is only a time on the day: no mission, no link.
    if (entry.kind === "general") {
      setBlocks((current) => [
        ...current,
        {
          id: planBlockId(),
          start_time: entry.startTime,
          end_time: entry.endTime,
          title: entry.title,
          category: "other",
          source_type: "manual",
          source_id: null,
        },
      ]);
      return;
    }

    setBlocks((current) => {
      const existing = entry.task
        ? current.find(
            (block) =>
              block.source_type === "task" && block.source_id === entry.task?.id
          )
        : undefined;
      if (existing) {
        return current.map((block) =>
          block.id === existing.id
            ? { ...block, start_time: entry.startTime, end_time: entry.endTime }
            : block
        );
      }
      return [...current, taskBlock(entry)];
    });
  }

  function removeAnchor(anchor: TodayPlanAnchor) {
    const next = removeAnchorFromPlan({ metadata, blocks }, anchor);
    setMetadata(next.metadata);
    setBlocks(next.blocks);
  }

  /** The anchor a habit or reflection block was reserved for. */
  function anchorForBlock(block: DayPlanBlock): TodayPlanAnchor | undefined {
    return [...metadata.anchors, ...anchorOptions].find(
      (anchor) =>
        anchor.source_type === block.source_type &&
        (anchor.source_id ?? anchor.id) === block.source_id
    );
  }

  /**
   * Takes a block out of today's plan.
   *
   * For a habit or reflection the anchor goes too, so it does not quietly
   * reappear under "Also today". The task, habit or template behind the
   * block is a separate record and is never touched.
   */
  function removeBlock(block: DayPlanBlock) {
    const anchor = anchorForBlock(block);
    if (anchor) {
      removeAnchor(anchor);
    } else {
      setBlocks((current) => current.filter((item) => item.id !== block.id));
    }
    setStepError(null);
  }

  function keepBlockFlexible(block: DayPlanBlock) {
    const anchor = anchorForBlock(block);
    if (!anchor) return;
    const next = keepAnchorFlexible({ metadata, blocks }, anchor);
    setMetadata(next.metadata);
    setBlocks(next.blocks);
  }

  function validateCurrentStep() {
    if (step === MOOD_STEP && !metadata.mood) {
      return "Pick how you are feeling before moving on.";
    }
    if (step === OUTCOMES_STEP && !mainOutcome?.title.trim()) {
      return "Choose your main focus before moving on.";
    }
    if (
      step === TIMELINE_STEP &&
      timeToMinutes(metadata.day_end) <= timeToMinutes(metadata.day_start)
    ) {
      return "Your day must end after it starts. Use “Edit day hours” to fix it.";
    }
    if (step === TIMELINE_STEP && problems.invalidBlockIds.length > 0) {
      return "A block needs attention: every block needs a title and an end time after its start. Tap the red block to fix it.";
    }
    if (step === TIMELINE_STEP && problems.overlappingBlockIds.length > 0) {
      return "Two blocks overlap. Choose “Space them out”, or change a start or end time.";
    }
    return null;
  }

  function goNext() {
    const error = validateCurrentStep();
    if (error) {
      setStepError(error);
      return;
    }
    // The priorities become blocks on the way into the timeline. Safe to
    // repeat on every pass: a priority that already has a block keeps its
    // times and only follows a changed choice.
    if (step === OUTCOMES_STEP) {
      setBlocks((current) =>
        buildTodayPlanSchedule({ blocks: current, metadata })
      );
    }
    setStepError(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStepError(null);
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requestClose() {
    if (isDirty) setCloseOpen(true);
    else router.push(returnHref);
  }

  function discardDraft() {
    sessionStorage.removeItem(draftKey(userId, date));
    setCloseOpen(false);
    router.push(returnHref);
  }

  /**
   * Saves an edited plan in place and stays on the timeline.
   *
   * Unlike the ritual's last step this does not ask for a main priority:
   * moving a block in a plan that predates the priorities step must not be
   * refused for a reason the editor never shows. The ritual timestamp is
   * kept, or set now if the plan never had one, since a saved plan is a
   * planned day either way.
   */
  async function savePlanEdits() {
    if (savingRef.current) return;
    const error = validateCurrentStep();
    if (error) {
      setStepError(error);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setStepError(null);
    const savedMetadata: TodayPlanMetadata = {
      ...metadata,
      outcomes: metadata.outcomes.filter((outcome) => outcome.title.trim()),
      ritual_completed_at:
        metadata.ritual_completed_at ?? new Date().toISOString(),
    };
    try {
      await upsertDayPlan(supabase, userId, {
        plan_date: date,
        blocks,
        notes: serializeTodayPlanNotes(savedMetadata, parsedNotes.legacyNotes),
      });
      setMetadata(savedMetadata);
      initialFingerprint.current = fingerprint({
        metadata: savedMetadata,
        blocks,
      });
      sessionStorage.removeItem(draftKey(userId, date));
      setSavedAt(
        new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date())
      );
      window.dispatchEvent(new CustomEvent("lifequest-data-updated"));
      router.refresh();
    } catch (error) {
      console.error("Failed to save today plan", error);
      setSaveError(
        "Not saved. Your changes are still here in this tab. Check your connection and save again."
      );
      // Save sits in the footer and the message at the end of the page; on
      // a phone it would land out of sight, as if nothing had happened.
      requestAnimationFrame(() =>
        document
          .getElementById("plan-save-error")
          ?.scrollIntoView?.({ block: "center", behavior: "smooth" })
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function commitPlan() {
    if (savingRef.current) return;
    if (!canCommit) {
      setStepError(
        "Resolve the highlighted plan issues before committing the day."
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    const committedMetadata: TodayPlanMetadata = {
      ...metadata,
      outcomes: metadata.outcomes.filter((outcome) => outcome.title.trim()),
      ritual_completed_at: new Date().toISOString(),
    };

    try {
      await upsertDayPlan(supabase, userId, {
        plan_date: date,
        blocks,
        notes: serializeTodayPlanNotes(
          committedMetadata,
          parsedNotes.legacyNotes
        ),
      });
      sessionStorage.removeItem(draftKey(userId, date));
      window.dispatchEvent(new CustomEvent("lifequest-data-updated"));
      router.push(returnHref);
      router.refresh();
    } catch (error) {
      console.error("Failed to commit today plan", error);
      setSaveError(
        "Your plan is still safe in this tab, but it could not be saved. Check your connection and retry."
      );
      // Only a failure frees Save again; after success the page is leaving.
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  const journalTitles = journalAnchorTitles(journals);
  const anchorOptions: TodayPlanAnchor[] = [
    ...habits.map((habit) => ({
      id: `habit-${habit.id}`,
      source_type: "habit" as const,
      source_id: habit.id,
      title: habit.name,
      emoji: habit.emoji,
      duration_minutes: 15,
    })),
    ...journals.map((journal) => ({
      id: `journal-${journal.id}`,
      source_type: "journal" as const,
      source_id: journal.id,
      title: journalTitles.get(journal.id) ?? journal.name,
      emoji: journal.icon,
      duration_minutes: 10,
    })),
    ...(workoutsEnabled
      ? [
          {
            id: "workout-daily-anchor",
            source_type: "workout" as const,
            source_id: null,
            title: "Training session",
            emoji: "🏋️",
            duration_minutes: 75,
          },
        ]
      : []),
  ];

  // Habits and reflections kept for today without a time block. They stay in
  // metadata.anchors either way, so committing still records what the day
  // was meant to carry.
  const flexible = flexibleAnchors(metadata, blocks);
  const reservedAnchorCount = metadata.anchors.filter(
    (anchor) => !anchorTakesTime(anchor) && blockForAnchor(blocks, anchor)
  ).length;

  function anchorCompletedToday(anchor: TodayPlanAnchor) {
    if (anchor.source_type === "habit") {
      return Boolean(
        habits.find((habit) => habit.id === anchor.source_id)?.completedToday
      );
    }
    if (anchor.source_type === "journal") {
      return Boolean(
        journals.find((journal) => journal.id === anchor.source_id)
          ?.completedToday
      );
    }
    return false;
  }

  const sortedBlocks = blocks
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const selectedBlock =
    blocks.find((block) => block.id === selectedBlockId) ?? null;

  // Blocks the axis cannot draw, because their times do not parse or run
  // backwards. The editor still reaches them through the list below it.
  const unplaceableBlocks = sortedBlocks.filter((block) => {
    const start = timeToMinutes(block.start_time);
    const end = timeToMinutes(block.end_time);
    return !Number.isFinite(start) || !Number.isFinite(end) || end <= start;
  });

  const Container = embedded ? "div" : "main";

  return (
    <Container className={cn("bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_38%),hsl(var(--background))]", embedded ? "rounded-3xl border pb-28 sm:pb-6" : "min-h-svh pb-28 sm:pb-10")}>
      <header className={cn("border-b bg-background/92 backdrop-blur-xl", embedded ? "rounded-t-3xl" : "sticky top-0 z-30")}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close daily planning"
            onClick={requestClose}
          >
            <X className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {editMode ? "Edit today's plan" : "Today's Plan"}
            </p>
            <p className="truncate text-sm text-muted-foreground">{dateLabel}</p>
          </div>
          {editMode ? (
            <span
              role="status"
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                saveError && isDirty
                  ? "text-destructive"
                  : isDirty
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-muted-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full",
                  saveError && isDirty
                    ? "bg-destructive"
                    : isDirty
                      ? "bg-amber-500"
                      : "bg-primary"
                )}
              />
              {saving
                ? "Saving…"
                : saveError && isDirty
                  ? "Not saved"
                  : isDirty
                  ? "Unsaved changes"

                  : savedAt
                    ? `Saved at ${savedAt}`
                    : "All changes saved"}
            </span>
          ) : (
            <span className="text-right text-sm font-medium text-muted-foreground">
              <span className="hidden sm:inline">{STEPS[step].label} · </span>
              Step {step + 1} of {STEPS.length}
            </span>
          )}
        </div>
        <div
          className={cn("grid h-1 gap-1 px-4 sm:px-8", editMode && "hidden")}
          style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
          aria-hidden
        >
          {STEPS.map((item, index) => (
            <span
              key={item.label}
              className={cn(
                "rounded-full transition-colors",
                index <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        {restoredDraft && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/8 p-3 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Your unfinished plan was restored.</p>
              <p className="text-xs text-muted-foreground">
                Nothing was written to the database while you were planning.
              </p>
            </div>
            <button
              type="button"
              className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setRestoredDraft(false)}
            >
              Dismiss
            </button>
          </div>
        )}

        <section aria-labelledby={`planner-step-${step}`}>
          <div className="mb-7 max-w-2xl">
            <h1
              id={`planner-step-${step}`}
              className="text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]"
            >
              {editMode ? "Your plan for today" : STEPS[step].title}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {editMode
                ? "Move, lengthen or add blocks, then save. Tap a block for exact times."
                : STEPS[step].description}
            </p>
            {editMode && (
              <p className="mt-2 text-sm">
                <Link
                  href="?step=ritual"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  Start the full daily ritual instead
                </Link>
                <span className="text-muted-foreground">
                  {" "}
                  (mood, intention, priorities)
                </span>
              </p>
            )}
          </div>

          {step === MOOD_STEP && (
            <div className="mx-auto grid w-full max-w-2xl gap-5">
              <Card className="rounded-3xl">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <MoodSelector
                    options={DEFAULT_MOOD_OPTIONS}
                    value={metadata.mood}
                    onChange={(mood) => updateMetadata({ mood })}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Required. How a day starts changes what is reasonable to
                    plan into it.
                  </p>

                  {/* Only after there is a feeling to explain -- asking why
                      before asking whether puts the answer first. */}
                  {metadata.mood && (
                    <div className="space-y-3 border-t pt-4">
                      <div>
                        <p className="text-sm font-semibold">
                          What is behind that?
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Optional, and as many as apply.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {MOOD_REASONS.map((reason) => {
                          const chosen = metadata.mood_reasons.includes(
                            reason.id
                          );
                          return (
                            <button
                              key={reason.id}
                              type="button"
                              aria-pressed={chosen}
                              onClick={() => toggleMoodReason(reason.id)}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                                chosen
                                  ? "border-primary/35 bg-primary/10 text-primary"
                                  : "border-border/60 bg-background/70 hover:border-primary/25"
                              )}
                            >
                              <span aria-hidden="true" className="text-base">
                                {reason.emoji}
                              </span>
                              {reason.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="plan-mood-reason-note"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Something else
                        </label>
                        <Input
                          id="plan-mood-reason-note"
                          value={metadata.mood_reason_note}
                          onChange={(event) =>
                            updateMetadata({
                              mood_reason_note: event.target.value,
                            })
                          }
                          maxLength={MOOD_REASON_NOTE_MAX}
                          placeholder="In your own words"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === INTENTION_STEP && (
            <div className="mx-auto grid w-full max-w-2xl gap-5">
              <Card className="rounded-3xl">
                <CardContent className="space-y-3 p-5 sm:p-6">
                  {/* The step heading already asks the question, so repeating
                      it on screen would be noise -- but the field still needs
                      a name for anyone not reading the heading. */}
                  <label htmlFor="plan-intention" className="sr-only">
                    What quality should guide today?
                  </label>
                  <Textarea
                    id="plan-intention"
                    value={metadata.intention}
                    onChange={(event) =>
                      updateMetadata({ intention: event.target.value })
                    }
                    maxLength={500}
                    placeholder="Example: Focus on the important stuff."
                    className="min-h-32 rounded-2xl bg-background/80 text-base"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{metadata.intention.length}/500</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === OUTCOMES_STEP && (
            <TodayPriorities
              outcomes={metadata.outcomes}
              tasks={taskList}
              today={date}
              mainMissing={Boolean(stepError) && !mainOutcome?.title.trim()}
              creatingRole={creatingRole}
              createError={createTaskError}
              onSelectTask={assignTaskToRole}
              onCreateTask={createAndAssignTask}
              onUseText={(role, title) =>
                updateOutcome(role, { title, task_id: null })
              }
              onDurationChange={(role, minutes) =>
                updateOutcome(role, { duration_minutes: minutes })
              }
              onRemove={removeOutcome}
            />
          )}

          {step === TIMELINE_STEP && (
            <div className="w-full max-w-3xl space-y-5">
              <DayFrameBar
                hours={{
                  day_start: metadata.day_start,
                  day_end: metadata.day_end,
                  shutdown_time: metadata.shutdown_time,
                }}
                blocks={blocks}
                onChange={(hours) => updateMetadata(hours)}
              />

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => openAdd()}
                  className="h-12 rounded-xl px-5 text-base sm:h-11"
                >
                  <Plus aria-hidden="true" className="size-5" />
                  Add to your day
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tasks, habits, reflections, breaks or anything else.
                </p>
              </div>

              {problems.overlappingBlockIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/35 bg-destructive/8 p-3 text-sm">
                  <TriangleAlert
                    aria-hidden="true"
                    className="size-4 shrink-0 text-destructive"
                  />
                  <p className="min-w-0 flex-1">
                    Two blocks want the same minutes.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBlocks((current) => resolveOverlaps(current));
                      setStepError(null);
                    }}
                  >
                    Space them out
                  </Button>
                </div>
              )}

              <div>
                <PlanTimeline
                  blocks={blocks}
                  dayStart={metadata.day_start}
                  dayEnd={metadata.day_end}
                  shutdownTime={metadata.shutdown_time}
                  invalidBlockIds={problems.invalidBlockIds}
                  overlappingBlockIds={problems.overlappingBlockIds}
                  selectedId={selectedBlockId}
                  onSelect={setSelectedBlockId}
                  onChange={(next) => {
                    setBlocks(next);
                    setStepError(null);
                  }}
                  onCreateBlock={(startTime) => {
                    const start = timeToMinutes(startTime);
                    const next = occupiedSpans(blocks).find(
                      (span) => span.startMinutes >= start
                    );
                    openAdd({
                      startMinutes: start,
                      roomMinutes: (next?.startMinutes ?? 24 * 60 - 1) - start,
                    });
                  }}
                />
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Drag a block to move it; everything after it moves along.
                  Pull the bar on its bottom edge to make it longer. Tap a
                  block for exact times.
                </p>

                {/* A block with an unreadable time cannot be drawn on a
                    time axis, so it would vanish exactly when it needs
                    fixing. Listed here until it is valid again. */}
                {unplaceableBlocks.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {unplaceableBlocks.map((block) => (
                      <li key={block.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedBlockId(block.id)}
                          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-destructive/55 bg-destructive/8 px-3 py-2 text-left text-sm"
                        >
                          <TriangleAlert className="size-4 shrink-0 text-destructive" />
                          <span className="min-w-0 flex-1 truncate">
                            {block.title || "Untitled block"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            needs a valid time
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <PlanCapacityLine
                capacity={capacity}
                hasOverlap={problems.overlappingBlockIds.length > 0}
              />

              <AlsoToday
                anchors={flexible}
                isDone={anchorCompletedToday}
                onAdd={() => openAdd({ kind: "habit", mode: "flexible" })}
                onSchedule={(anchor) =>
                  openAdd({ anchorId: anchor.id, mode: "block" })
                }
                onRemove={removeAnchor}
              />
            </div>
          )}

          {step === COMMIT_STEP && (
            <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="min-w-0 space-y-8">
                <section
                  aria-labelledby="review-focus"
                  className="border-l-[3px] border-primary pl-5"
                >
                  <h2
                    id="review-focus"
                    className="text-xs font-semibold uppercase tracking-[0.12em] text-primary"
                  >
                    Your main focus
                  </h2>
                  <p className="mt-1.5 break-words text-xl font-medium">
                    {mainOutcome?.title || "Choose your main focus"}
                  </p>
                  {metadata.intention && (
                    <p className="mt-1.5 text-sm italic text-muted-foreground">
                      “{metadata.intention}”
                    </p>
                  )}
                  {metadata.outcomes
                    .filter(
                      (outcome) =>
                        outcome.role !== "must_win" && outcome.title.trim()
                    )
                    .map((outcome) => (
                      <p key={outcome.role} className="mt-3 text-sm">
                        <span className="text-muted-foreground">
                          {PRIORITY_LABELS[outcome.role]}:
                        </span>{" "}
                        <span className="font-medium">{outcome.title}</span>
                      </p>
                    ))}
                </section>

                <section aria-labelledby="review-day" className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-2">
                    <h2 id="review-day" className="text-base font-semibold">
                      Your day · {metadata.day_start}–{metadata.day_end}
                    </h2>
                    <PlanCapacityLine
                      capacity={capacity}
                      hasOverlap={problems.overlappingBlockIds.length > 0}
                    />
                  </div>
                  {sortedBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No time blocks yet. Go back to add some, or save the
                      day as it is.
                    </p>
                  ) : (
                    <ol className="divide-y">
                      {sortedBlocks.map((block) => (
                        <li key={block.id} className="flex gap-4 py-2.5">
                          <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                            {block.start_time}–{block.end_time}
                          </span>
                          <span className="min-w-0 flex-1 break-words text-sm font-medium">
                            {block.title || "Untitled block"}
                            {block.outcome_role && (
                              <span className="ml-2 font-normal text-primary">
                                {PRIORITY_LABELS[block.outcome_role]}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {metadata.shutdown_time
                      ? `Day-end reminder at ${metadata.shutdown_time}. It reserves no time.`
                      : "No day-end reminder."}
                  </p>
                </section>

                <section aria-labelledby="review-also" className="space-y-1.5">
                  <h2 id="review-also" className="text-base font-semibold">
                    Also today
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      No time reserved
                    </span>
                  </h2>
                  <p className="text-sm">
                    {flexible.length > 0
                      ? flexible.map((anchor) => anchor.title).join(" · ")
                      : "Nothing kept flexible today."}
                  </p>
                  {reservedAnchorCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {reservedAnchorCount === 1
                        ? "1 habit or reflection has a time block above."
                        : `${reservedAnchorCount} habits or reflections have a time block above.`}
                    </p>
                  )}
                </section>

                {(problems.invalidBlockIds.length > 0 ||
                  problems.overlappingBlockIds.length > 0) && (
                  <div className="flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/8 p-4 text-sm">
                    <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div>
                      <p className="font-medium">Timeline needs attention</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Go back to the timeline and fix invalid or overlapping
                        blocks before saving.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <aside className="h-fit space-y-4 border-t pt-5 lg:sticky lg:top-24 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  You are committing to direction, not perfection. Replan
                  when reality changes.
                </p>
                <p className="text-sm text-muted-foreground">
                  {saving
                    ? "Saving…"
                    : "Saving replaces today's saved plan."}
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="hidden w-full rounded-xl sm:inline-flex"
                  disabled={!canCommit}
                  onClick={() => void commitPlan()}
                >
                  {saving ? (
                    "Saving…"
                  ) : (
                    <>
                      <Check className="mr-1.5 size-5" />
                      Save today&apos;s plan
                    </>
                  )}
                </Button>
                {saveError && (
                  <div
                    role="alert"
                    className="space-y-2 rounded-xl border border-destructive/35 bg-destructive/8 p-3"
                  >
                    <p className="text-sm text-destructive">{saveError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => void commitPlan()}
                      disabled={saving}
                    >
                      Retry save
                    </Button>
                  </div>
                )}
              </aside>
            </div>
          )}
        </section>

        {stepError && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-2xl border border-destructive/35 bg-destructive/8 p-4 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {stepError}
          </div>
        )}
        {editMode && saveError && (
          <div
            id="plan-save-error"
            role="alert"
            className="mt-6 flex items-start gap-2 rounded-2xl border border-destructive/35 bg-destructive/8 p-4 text-sm text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {saveError}
          </div>
        )}
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/94 px-4 pb-[calc(0.75rem+var(--safe-area-bottom))] pt-3 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:px-8 sm:pb-8 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={step === MOOD_STEP || editMode ? requestClose : goBack}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            {step === MOOD_STEP || editMode ? "Dashboard" : "Back"}
          </Button>

          {/* Nothing reaches the database before the last step; saying so
              where the buttons are answers "did that save?" before it is
              asked. The editor says it in the header instead. */}
          {!editMode && (
            <span className="hidden min-w-0 truncate text-sm text-muted-foreground min-[400px]:block">
              Draft · not saved
            </span>
          )}

          {editMode ? (
            <Button
              type="button"
              size="lg"
              onClick={() => void savePlanEdits()}
              disabled={saving || !isDirty}
              className="h-12"
            >
              <Check className="mr-1.5 size-4" />
              {saving ? "Saving…" : isDirty ? "Save plan" : "Saved"}
            </Button>
          ) : step < STEPS.length - 1 ? (
            <Button type="button" size="lg" onClick={goNext} className="h-12">
              {step === TIMELINE_STEP ? "Review plan" : "Next"}
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => void commitPlan()}
              disabled={!canCommit}
              className="h-12 sm:hidden"
            >
              {saving ? "Saving…" : "Save plan"}
            </Button>
          )}
        </div>
      </footer>

      {/* The block's properties belong on top of the day, not underneath it:
          on a phone an editor below the axis is off-screen exactly when it
          opens, and the block it describes is no longer in view. */}
      <BlockEditorDialog
        block={selectedBlock}
        blocks={blocks}
        dayStart={metadata.day_start}
        dayEnd={metadata.day_end}
        onOpenChange={(open) => {
          if (!open) setSelectedBlockId(null);
        }}
        onApply={(next) => {
          setBlocks(next);
          setStepError(null);
        }}
        onRemove={removeBlock}
        onKeepFlexible={keepBlockFlexible}
      />

      <AddToDayDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        request={addRequest}
        blocks={blocks}
        dayStart={metadata.day_start}
        dayEnd={metadata.day_end}
        today={date}
        tasks={taskList}
        habits={habits}
        journals={journals}
        anchorOptions={anchorOptions}
        plannedAnchors={metadata.anchors}
        creatingTask={creatingTask}
        createTaskError={addTaskError}
        onCreateTask={createTaskForDay}
        onSubmit={addToDay}
      />

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-b-none rounded-t-3xl sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editMode ? "Leave without saving?" : "Leave daily planning?"}
            </DialogTitle>
            <DialogDescription>
              {editMode
                ? "Your changes are not saved yet. You can keep them as a draft in this tab, or throw them away."
                : "Your draft stays in this tab unless you explicitly discard it."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2">
            {editMode && (
              <Button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setCloseOpen(false);
                  await savePlanEdits();
                }}
              >
                Save plan
              </Button>
            )}
            <Button
              type="button"
              variant={editMode ? "outline" : "default"}
              onClick={() => setCloseOpen(false)}
            >
              Continue {editMode ? "editing" : "planning"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCloseOpen(false);
                router.push(returnHref);
              }}
            >
              Leave and keep draft
            </Button>
            <Button type="button" variant="destructive" onClick={discardDraft}>
              Discard draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

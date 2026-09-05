"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  CircleGauge,
  Clock3,
  Dumbbell,
  Flame,
  HeartPulse,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { TaskCombobox } from "@/components/planning/TaskCombobox";
import { PlanTimeline } from "@/components/planning/PlanTimeline";
import type {
  DayPlanBlock,
  DayPlanCategory,
  DayPlanOutcomeRole,
} from "@/lib/types";
import {
  anchorTakesTime,
  applyBlockTimeChange,
  buildTodayPlanSchedule,
  calculateTodayPlanCapacity,
  createDefaultTodayPlanMetadata,
  findTodayPlanBlockProblems,
  formatPlanMinutes,
  minutesToTime,
  nextGridStart,
  parseTodayPlanNotes,
  planBlockId,
  resolveOverlaps,
  serializeTodayPlanNotes,
  shiftEndTime,
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
}

interface PlannerDraft {
  metadata: TodayPlanMetadata;
  blocks: DayPlanBlock[];
}

const STEPS = [
  {
    label: "Mood",
    title: "How are you feeling right now?",
    description: "Name it before you plan around it. One tap is enough.",
  },
  {
    label: "Intention",
    title: "What quality should guide today?",
    description: "A short line you can hold every later tradeoff against.",
  },
  {
    label: "Top Three",
    title: "Set up your Top Three for Today",
    description: "One must-win, one progress move, and one health commitment.",
  },
  {
    label: "Anchors",
    title: "Add your daily anchors",
    description: "Make room for habits, reflection, training, and shutdown.",
  },
  {
    label: "Timeline",
    title: "Shape the timeline",
    description: "Give each commitment a place, not just a priority.",
  },
  {
    label: "Commit",
    title: "Commit to the day",
    description: "Check capacity, resolve conflicts, and start with clarity.",
  },
] as const;

const OUTCOME_META: Record<
  DayPlanOutcomeRole,
  {
    label: string;
    helper: string;
    mission: string;
    icon: typeof Target;
    style: string;
    defaultDuration: number;
  }
> = {
  must_win: {
    label: "Must Win",
    helper: "What one thing will create the biggest impact today?",
    mission: "Main Quest",
    icon: Target,
    style:
      "border-violet-500/35 bg-violet-500/8 text-violet-700 dark:text-violet-300",
    defaultDuration: 90,
  },
  progress: {
    label: "Progress",
    helper: "A concrete move that compounds toward your bigger goals.",
    mission: "Side Quest",
    icon: Sparkles,
    style:
      "border-blue-500/35 bg-blue-500/8 text-blue-700 dark:text-blue-300",
    defaultDuration: 60,
  },
  health: {
    label: "Health",
    helper: "The action that protects your body, energy, or recovery.",
    mission: "Recovery Quest",
    icon: HeartPulse,
    style:
      "border-emerald-500/35 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
    defaultDuration: 45,
  },
};

const CATEGORY_LABELS: Record<DayPlanCategory, string> = {
  deep_work: "Deep Work",
  meeting: "Meeting",
  break: "Break",
  personal: "Personal",
  exercise: "Exercise",
  other: "Other",
};

const MISSION_LABELS: Record<
  NonNullable<DayPlanBlock["mission_type"]>,
  string
> = {
  main_quest: "Main Quest",
  side_quest: "Side Quest",
  anchor: "Anchor",
  recovery: "Recovery",
};

const DURATION_OPTIONS = [15, 25, 45, 60, 90, 120];

function fingerprint(value: PlannerDraft) {
  return JSON.stringify(value);
}

function draftKey(userId: string, date: string) {
  return `lifequest:today-plan:${userId}:${date}`;
}

function normalizeDraft(value: unknown): PlannerDraft | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PlannerDraft>;
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

  return metadata ? { metadata, blocks } : null;
}

function roleOutcome(
  metadata: TodayPlanMetadata,
  role: DayPlanOutcomeRole
) {
  return metadata.outcomes.find((outcome) => outcome.role === role) ?? null;
}

function lastScheduledMinute(blocks: DayPlanBlock[], fallback: string) {
  return blocks.reduce(
    (latest, block) =>
      Math.max(latest, timeToMinutes(block.end_time) || 0),
    timeToMinutes(fallback) || 8 * 60
  );
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
  const [step, setStep] = useState(0);
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
  const [closeOpen, setCloseOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
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
        } else {
          sessionStorage.removeItem(draftKey(userId, date));
        }
      }
    } catch {
      sessionStorage.removeItem(draftKey(userId, date));
    } finally {
      setDraftReady(true);
    }
  }, [date, userId]);

  useEffect(() => {
    if (!draftReady) return;
    if (!isDirty) {
      sessionStorage.removeItem(draftKey(userId, date));
      return;
    }
    sessionStorage.setItem(draftKey(userId, date), JSON.stringify(currentDraft));
  }, [currentDraft, date, draftReady, isDirty, userId]);

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

  function assignTaskToRole(role: DayPlanOutcomeRole, task: TodayPlannerTask) {
    updateOutcome(role, {
      title: task.title,
      task_id: task.id,
      duration_minutes:
        task.estimateMinutes ?? OUTCOME_META[role].defaultDuration,
    });
  }

  async function createAndAssignTask(role: DayPlanOutcomeRole, title: string) {
    const trimmed = title.trim();
    if (!trimmed || creatingRole) return;

    setCreatingRole(role);
    setCreateTaskError(null);
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
      assignTaskToRole(role, plannerTask);
    } catch (error) {
      console.error("Failed to create task from Today Plan", error);
      setCreateTaskError({
        role,
        message: "Could not create the task. Please try again.",
      });
    } finally {
      setCreatingRole(null);
    }
  }

  function toggleAnchor(anchor: TodayPlanAnchor) {
    setMetadata((current) => {
      const selected = current.anchors.some((item) => item.id === anchor.id);
      return {
        ...current,
        anchors: selected
          ? current.anchors.filter((item) => item.id !== anchor.id)
          : [...current.anchors, anchor],
      };
    });
  }

  function updateBlock(id: string, patch: Partial<DayPlanBlock>) {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...patch } : block
      )
    );
    setStepError(null);
  }

  /**
   * Retimes a block and carries the rest of the day with it.
   *
   * Separate from updateBlock because only a time change ripples -- renaming
   * a block or switching its category must leave the schedule alone.
   */
  function updateBlockTime(
    id: string,
    patch: Pick<Partial<DayPlanBlock>, "start_time" | "end_time">
  ) {
    setBlocks((current) => applyBlockTimeChange(current, id, patch));
    setStepError(null);
  }

  function newBlock(
    startTime: string,
    endTime: string,
    category: DayPlanCategory = "other"
  ): DayPlanBlock {
    return {
      id: planBlockId(),
      start_time: startTime,
      end_time: endTime,
      title: category === "break" ? "Recovery break" : "New plan block",
      category,
      mission_type: category === "break" ? "recovery" : "side_quest",
      source_type: "manual",
    };
  }

  function addManualBlock(category: DayPlanCategory = "other") {
    const last = lastScheduledMinute(blocks, metadata.day_start);
    const start = blocks.length
      ? nextGridStart(last)
      : Math.min(last, 23 * 60);
    const end = Math.min(start + 30, 23 * 60 + 59);
    const block = newBlock(minutesToTime(start), minutesToTime(end), category);
    setBlocks((current) => [...current, block]);
    setSelectedBlockId(block.id);
  }

  /**
   * Adds a block into free time on the axis.
   *
   * The timeline sized it to fit the gap it was dropped into, so this never
   * ripples the rest of the day -- it cannot collide with anything. Selected
   * straight away, since an untitled block is the next thing to deal with.
   */
  function createBlockAt(startTime: string, endTime: string) {
    const block = newBlock(startTime, endTime);
    setBlocks((current) => [...current, block]);
    setSelectedBlockId(block.id);
    setStepError(null);
  }

  function validateCurrentStep() {
    if (step === 0 && !metadata.mood) {
      return "Pick how you are feeling before moving on.";
    }
    if (step === 2 && !mainOutcome?.title.trim()) {
      return "Choose one Must Win before moving on.";
    }
    if (
      step === 3 &&
      timeToMinutes(metadata.day_end) <= timeToMinutes(metadata.day_start)
    ) {
      return "Your day must end after it starts.";
    }
    if (step === 4 && problems.invalidBlockIds.length > 0) {
      return "Every block needs a title and an end time after its start.";
    }
    if (step === 4 && problems.overlappingBlockIds.length > 0) {
      return "Resolve overlapping blocks before the final check.";
    }
    return null;
  }

  function goNext() {
    const error = validateCurrentStep();
    if (error) {
      setStepError(error);
      return;
    }
    if (step === 3) {
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
    else router.push("/dashboard");
  }

  function discardDraft() {
    sessionStorage.removeItem(draftKey(userId, date));
    setCloseOpen(false);
    router.push("/dashboard");
  }

  async function commitPlan() {
    if (!canCommit) {
      setStepError(
        "Resolve the highlighted plan issues before committing the day."
      );
      return;
    }
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
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Failed to commit today plan", error);
      setSaveError(
        "Your plan is still safe in this tab, but it could not be saved. Check your connection and retry."
      );
    } finally {
      setSaving(false);
    }
  }

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
      title: journal.name,
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

  // Habits and journal prompts chosen as anchors, which no longer take a slot
  // on the timeline. They stay in metadata.anchors either way, so committing
  // still records what the day was meant to carry.
  const ridingAlong = metadata.anchors.filter(
    (anchor) => !anchorTakesTime(anchor)
  );

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

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_38%),hsl(var(--background))] pb-28 sm:pb-10">
      <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur-xl">
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
            <p className="truncate text-sm font-semibold">Today&apos;s Plan</p>
            <p className="truncate text-xs text-muted-foreground">{dateLabel}</p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <div
          className="grid h-1 gap-1 px-4 sm:px-8"
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
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
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
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {STEPS[step].title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {STEPS[step].description}
            </p>
          </div>

          {step === 0 && (
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
                </CardContent>
              </Card>
            </div>
          )}

          {step === 1 && (
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
                    placeholder="Example: Move calmly, finish what matters, and leave energy for training."
                    className="min-h-32 rounded-2xl bg-background/80 text-base"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>This is your decision filter, not another task.</span>
                    <span>{metadata.intention.length}/500</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {(Object.keys(OUTCOME_META) as DayPlanOutcomeRole[]).map(
                (role) => {
                  const outcome = roleOutcome(metadata, role);
                  const item = OUTCOME_META[role];
                  const Icon = item.icon;
                  return (
                    <Card
                      key={role}
                      // Card clips overflow by default for rounded image
                      // corners; every role renders a TaskCombobox whose
                      // dropdown needs to escape that clip.
                      className="overflow-visible rounded-3xl transition"
                    >
                      <CardContent className="space-y-4 p-5 sm:p-6">
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                              item.style
                            )}
                          >
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-semibold">{item.label}</h2>
                              <Badge
                                variant="outline"
                                className={cn("rounded-full", item.style)}
                              >
                                {item.mission}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {item.helper}
                            </p>
                          </div>
                        </div>
                        <TaskCombobox
                          ariaLabel={`${item.label} outcome`}
                          tasks={taskList}
                          linkedTaskId={outcome?.task_id ?? null}
                          value={outcome?.title ?? ""}
                          onChangeText={(text) =>
                            updateOutcome(role, { title: text, task_id: null })
                          }
                          onSelectTask={(task) => assignTaskToRole(role, task)}
                          onCreateTask={(title) =>
                            void createAndAssignTask(role, title)
                          }
                          creating={creatingRole === role}
                          placeholder={
                            role === "must_win"
                              ? "What must move today? Search or create a task…"
                              : role === "progress"
                                ? "What creates forward momentum? Search or create a task…"
                                : "What protects your energy? Search or create a task…"
                          }
                        />
                        {createTaskError?.role === role && (
                          <p role="alert" className="text-xs text-destructive">
                            {createTaskError.message}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {outcome?.task_id
                              ? "Linked to a task"
                              : "Standalone outcome"}
                          </span>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            Budget
                            <select
                              aria-label={`${item.label} time budget`}
                              value={
                                outcome?.duration_minutes ??
                                item.defaultDuration
                              }
                              onChange={(event) =>
                                updateOutcome(role, {
                                  duration_minutes: Number(
                                    event.target.value
                                  ),
                                })
                              }
                              className="h-9 rounded-lg border bg-background px-2 text-foreground"
                            >
                              {DURATION_OPTIONS.map((minutes) => (
                                <option key={minutes} value={minutes}>
                                  {formatPlanMinutes(minutes)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
              <div className="space-y-5">
                <Card className="rounded-3xl">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <Flame className="size-4 text-orange-500" />
                      <h2 className="font-semibold">Daily anchors</h2>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Select only the rituals worth protecting today. Habits and
                      reflections ride along with the day; only training takes a
                      slot on the timeline.
                    </p>
                    {anchorOptions.length > 0 ? (
                      <div className="mt-5 grid gap-2 sm:grid-cols-2">
                        {anchorOptions.map((anchor) => {
                          const selected = metadata.anchors.some(
                            (item) => item.id === anchor.id
                          );
                          const completed =
                            anchor.source_type === "habit"
                              ? habits.find(
                                  (habit) => habit.id === anchor.source_id
                                )?.completedToday
                              : anchor.source_type === "journal"
                                ? journals.find(
                                    (journal) => journal.id === anchor.source_id
                                  )?.completedToday
                                : false;
                          const Icon =
                            anchor.source_type === "workout"
                              ? Dumbbell
                              : anchor.source_type === "journal"
                                ? BookOpen
                                : Flame;
                          return (
                            <button
                              key={anchor.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleAnchor(anchor)}
                              className={cn(
                                "flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition",
                                selected
                                  ? "border-primary bg-primary/8 ring-1 ring-primary/15"
                                  : "hover:border-primary/30 hover:bg-primary/5"
                              )}
                            >
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-lg">
                                {anchor.emoji || <Icon className="size-4" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {anchor.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {completed
                                    ? "Already completed"
                                    : anchorTakesTime(anchor)
                                      ? `${formatPlanMinutes(anchor.duration_minutes)} on the timeline`
                                      : "Rides along, no time slot"}
                                </span>
                              </span>
                              <span
                                className={cn(
                                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                                  selected &&
                                    "border-primary bg-primary text-primary-foreground"
                                )}
                              >
                                {selected && <Check className="size-3.5" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-5 rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                        Add habits or journal templates to turn them into
                        protected anchors.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card className="h-fit rounded-3xl lg:sticky lg:top-24">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <Clock3 className="size-4 text-violet-500" />
                    <h2 className="font-semibold">Day boundaries</h2>
                  </div>
                  {/* Three fields of the same kind, so they get the same
                      cell and the same treatment. The shutdown field used to
                      sit full width below with a moon icon inside it, which
                      collided with the digits: Input carries sm:px-2.5, and a
                      breakpointless pl-10 does not survive that from 640px
                      up. The label already says what the field is. */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      Day starts
                      <Input
                        type="time"
                        value={metadata.day_start}
                        onChange={(event) =>
                          updateMetadata({
                            day_start: event.target.value,
                            day_end: shiftEndTime(
                              metadata.day_start,
                              metadata.day_end,
                              event.target.value
                            ),
                          })
                        }
                        className="h-11 rounded-xl text-foreground"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      Day ends
                      <Input
                        type="time"
                        value={metadata.day_end}
                        onChange={(event) =>
                          updateMetadata({ day_end: event.target.value })
                        }
                        className="h-11 rounded-xl text-foreground"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      Shutdown ritual
                      <Input
                        type="time"
                        value={metadata.shutdown_time}
                        onChange={(event) =>
                          updateMetadata({ shutdown_time: event.target.value })
                        }
                        className="h-11 rounded-xl text-foreground"
                      />
                    </label>
                  </div>
                  <p className="rounded-2xl bg-muted/55 p-3 text-xs leading-relaxed text-muted-foreground">
                    A shutdown time turns planning into a bounded commitment.
                    Unused capacity is recovery, not failure.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
              <div className="space-y-3">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Moving a block moves everything after it. Changes remain
                    local until you commit on the next step.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addManualBlock("break")}
                    >
                      <HeartPulse className="mr-1.5 size-4" />
                      Add break
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => addManualBlock()}
                    >
                      <Plus className="mr-1.5 size-4" />
                      Add block
                    </Button>
                  </div>
                </div>

                {ridingAlong.length > 0 && (
                  // Read-only on purpose: checking a habit here would write to
                  // the database, and this step promises that nothing is saved
                  // until the final step. Checking them off stays on the home
                  // screen, where it already works.
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-background/65 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Rides along
                    </span>
                    {ridingAlong.map((anchor) => {
                      const done = anchorCompletedToday(anchor);
                      return (
                        <span
                          key={anchor.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
                            done
                              ? "border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted/40"
                          )}
                        >
                          {done && <Check className="size-3" />}
                          <span aria-hidden="true">{anchor.emoji}</span>
                          {anchor.title}
                        </span>
                      );
                    })}
                    <span className="ml-auto text-xs text-muted-foreground">
                      No time slot needed
                    </span>
                  </div>
                )}

                {problems.overlappingBlockIds.length > 0 && (
                  <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/35 bg-destructive/8 p-4 text-sm">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" />
                    <p className="min-w-0 flex-1">
                      Two blocks want the same minutes.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBlocks((current) => resolveOverlaps(current));
                        setStepError(null);
                      }}
                    >
                      Space them out
                    </Button>
                  </div>
                )}

                {sortedBlocks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed bg-background/65 p-8 text-center">
                    <CalendarClock className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-3 font-medium">The timeline is empty.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Go back and choose commitments, or add a manual block.
                    </p>
                  </div>
                ) : (
                  <>
                    <PlanTimeline
                      blocks={blocks}
                      dayStart={metadata.day_start}
                      dayEnd={metadata.day_end}
                      invalidBlockIds={problems.invalidBlockIds}
                      overlappingBlockIds={problems.overlappingBlockIds}
                      selectedId={selectedBlockId}
                      onSelect={setSelectedBlockId}
                      onChange={(next) => {
                        setBlocks(next);
                        setStepError(null);
                      }}
                      onCreateBlock={createBlockAt}
                    />

                    {selectedBlock ? (
                      <div className="mt-3 rounded-2xl border bg-card p-4">
                        <div className="flex items-start gap-2">
                          <Input
                            aria-label="Block title"
                            value={selectedBlock.title}
                            onChange={(event) =>
                              updateBlock(selectedBlock.id, {
                                title: event.target.value,
                              })
                            }
                            maxLength={160}
                            className="h-11 min-w-0 flex-1 rounded-xl font-medium"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${selectedBlock.title}`}
                            onClick={() => {
                              setBlocks((current) =>
                                current.filter(
                                  (item) => item.id !== selectedBlock.id
                                )
                              );
                              setSelectedBlockId(null);
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {/* The fields stay alongside the drag gesture: a
                            pointer is faster, typing is exact, and a keyboard
                            user needs a way in that is not a drag. */}
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.25fr]">
                          <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                            Start
                            <Input
                              type="time"
                              value={selectedBlock.start_time}
                              onChange={(event) =>
                                updateBlockTime(selectedBlock.id, {
                                  start_time: event.target.value,
                                  end_time: shiftEndTime(
                                    selectedBlock.start_time,
                                    selectedBlock.end_time,
                                    event.target.value
                                  ),
                                })
                              }
                              className="h-10 rounded-xl text-foreground"
                            />
                          </label>
                          <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
                            End
                            <Input
                              type="time"
                              value={selectedBlock.end_time}
                              onChange={(event) =>
                                updateBlockTime(selectedBlock.id, {
                                  end_time: event.target.value,
                                })
                              }
                              className="h-10 rounded-xl text-foreground"
                            />
                          </label>
                          <label className="col-span-2 space-y-1 text-[11px] font-medium text-muted-foreground sm:col-span-1">
                            Type
                            <select
                              value={selectedBlock.category}
                              onChange={(event) =>
                                updateBlock(selectedBlock.id, {
                                  category: event.target
                                    .value as DayPlanCategory,
                                })
                              }
                              className="h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground"
                            >
                              {Object.entries(CATEGORY_LABELS).map(
                                ([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                )
                              )}
                            </select>
                          </label>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {selectedBlock.mission_type && (
                            <Badge
                              variant="outline"
                              className="rounded-full text-[10px]"
                            >
                              {MISSION_LABELS[selectedBlock.mission_type]}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatPlanMinutes(
                              Math.max(
                                0,
                                timeToMinutes(selectedBlock.end_time) -
                                  timeToMinutes(selectedBlock.start_time)
                              )
                            )}
                          </span>
                          {problems.invalidBlockIds.includes(
                            selectedBlock.id
                          ) && (
                            <span className="text-xs text-destructive">
                              Check title and time
                            </span>
                          )}
                          {problems.overlappingBlockIds.includes(
                            selectedBlock.id
                          ) && (
                            <span className="text-xs text-destructive">
                              Overlaps another block
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                        Drag a block to move it, pull its bottom edge to make it
                        longer. Select one to rename it or change its type.
                      </p>
                    )}

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
                              className="flex w-full items-center gap-2 rounded-xl border border-destructive/55 bg-destructive/8 px-3 py-2 text-left text-sm"
                            >
                              <TriangleAlert className="size-4 shrink-0 text-destructive" />
                              <span className="min-w-0 flex-1 truncate">
                                {block.title || "Untitled block"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                needs a valid time
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              <aside className="h-fit rounded-3xl border bg-background/75 p-5 lg:sticky lg:top-24">
                <CircleGauge className="size-5 text-primary" />
                <p className="mt-3 text-2xl font-semibold">
                  {formatPlanMinutes(capacity.plannedMinutes)}
                </p>
                <p className="text-xs text-muted-foreground">
                  planned inside {formatPlanMinutes(capacity.availableMinutes)}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      capacity.status === "over"
                        ? "bg-destructive"
                        : capacity.status === "full"
                          ? "bg-amber-500"
                          : "bg-primary"
                    )}
                    style={
                      {
                        width: `${Math.min(capacity.utilizationPercent, 100)}%`,
                      } as CSSProperties
                    }
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {capacity.remainingMinutes >= 0
                    ? `${formatPlanMinutes(capacity.remainingMinutes)} remains for transitions, interruptions, and recovery.`
                    : `${formatPlanMinutes(capacity.remainingMinutes)} over capacity. Remove or shorten a block.`}
                </p>
              </aside>
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <div className="space-y-5">
                <Card className="overflow-hidden rounded-3xl border-primary/25">
                  <CardContent className="p-0">
                    <div className="bg-primary/8 p-5 sm:p-6">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        Main Quest
                      </p>
                      <h2 className="mt-2 text-xl font-semibold">
                        {mainOutcome?.title || "Choose your Must Win"}
                      </h2>
                      {metadata.intention && (
                        <p className="mt-2 text-sm italic text-muted-foreground">
                          “{metadata.intention}”
                        </p>
                      )}
                    </div>
                    <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                      {metadata.outcomes
                        .filter(
                          (outcome) =>
                            outcome.role !== "must_win" && outcome.title.trim()
                        )
                        .map((outcome) => (
                          <div
                            key={outcome.role}
                            className="rounded-2xl border bg-background/70 p-4"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {OUTCOME_META[outcome.role].mission}
                            </p>
                            <p className="mt-1 text-sm font-medium">
                              {outcome.title}
                            </p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">Capacity check</h2>
                        <p className="text-xs text-muted-foreground">
                          Ambition is useful only when the day can hold it.
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full",
                          capacity.status === "over" &&
                            "border-destructive/40 text-destructive",
                          capacity.status === "full" &&
                            "border-amber-500/40 text-amber-700 dark:text-amber-300",
                          capacity.status === "balanced" &&
                            "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        )}
                      >
                        {capacity.utilizationPercent}% planned
                      </Badge>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          capacity.status === "over"
                            ? "bg-destructive"
                            : capacity.status === "full"
                              ? "bg-amber-500"
                              : "bg-primary"
                        )}
                        style={{
                          width: `${Math.min(capacity.utilizationPercent, 100)}%`,
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-muted/55 p-3">
                        <p className="text-sm font-semibold">
                          {formatPlanMinutes(capacity.availableMinutes)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Available
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/55 p-3">
                        <p className="text-sm font-semibold">
                          {formatPlanMinutes(capacity.plannedMinutes)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Planned
                        </p>
                      </div>
                      <div className="rounded-xl bg-muted/55 p-3">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            capacity.remainingMinutes < 0 && "text-destructive"
                          )}
                        >
                          {capacity.remainingMinutes < 0 ? "−" : ""}
                          {formatPlanMinutes(capacity.remainingMinutes)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Buffer
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {(problems.invalidBlockIds.length > 0 ||
                  problems.overlappingBlockIds.length > 0) && (
                  <div className="flex items-start gap-3 rounded-2xl border border-destructive/35 bg-destructive/8 p-4 text-sm">
                    <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
                    <div>
                      <p className="font-medium">Timeline needs attention</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Return to the timeline and fix invalid or overlapping
                        blocks before committing.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <aside className="h-fit space-y-4 lg:sticky lg:top-24">
                <Card className="rounded-3xl">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-violet-500" />
                      <h2 className="font-semibold">Day contract</h2>
                    </div>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Window</dt>
                        <dd className="font-medium">
                          {metadata.day_start}–{metadata.day_end}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Blocks</dt>
                        <dd className="font-medium">{blocks.length}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Anchors</dt>
                        <dd className="font-medium">
                          {metadata.anchors.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Shutdown</dt>
                        <dd className="font-medium">
                          {metadata.shutdown_time}
                        </dd>
                      </div>
                    </dl>
                    <div className="rounded-2xl bg-muted/55 p-4 text-xs leading-relaxed text-muted-foreground">
                      You are committing to direction, not perfection. Replan
                      when reality changes.
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      className="hidden w-full rounded-xl sm:inline-flex"
                      disabled={!canCommit}
                      onClick={() => void commitPlan()}
                    >
                      {saving ? (
                        "Committing..."
                      ) : (
                        <>
                          <Check className="mr-1.5 size-5" />
                          Commit Today&apos;s Plan
                        </>
                      )}
                    </Button>
                    {saveError && (
                      <div className="space-y-2 rounded-xl border border-destructive/35 bg-destructive/8 p-3">
                        <p className="text-xs text-destructive">{saveError}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => void commitPlan()}
                          disabled={saving}
                        >
                          Retry save
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/94 px-4 pb-[calc(0.75rem+var(--safe-area-bottom))] pt-3 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:px-8 sm:pb-8 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={step === 0 ? requestClose : goBack}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            {step === 0 ? "Dashboard" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" size="lg" onClick={goNext}>
              Next
              <ArrowRight className="ml-1.5 size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={() => void commitPlan()}
              disabled={!canCommit}
              className="sm:hidden"
            >
              {saving ? "Saving..." : "Commit Plan"}
            </Button>
          )}
        </div>
      </footer>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-b-none rounded-t-3xl sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>Leave daily planning?</DialogTitle>
            <DialogDescription>
              Your draft stays in this tab unless you explicitly discard it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2">
            <Button type="button" onClick={() => setCloseOpen(false)}>
              Continue planning
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCloseOpen(false);
                router.push("/dashboard");
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
    </main>
  );
}

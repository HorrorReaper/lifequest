"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  GripVertical,
  History,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createHabit,
  DuplicateHabitError,
  fetchHabits,
  hasDuplicateHabitName,
  setHabitLogCompletion,
  updateHabit,
} from "@/lib/habits";
import { addDays, dateInTimezone, formatDateOnly } from "@/lib/dates";
import { applyHabitCheckInReward } from "@/lib/habit-check-in";
import { completesHabitDay } from "@/lib/habit-day-complete";
import { useUserStore } from "@/lib/stores/user-store";
import {
  buildDateWindow,
  buildHabitSummary,
  habitLogKey,
  indexHabitLogs,
  moveHabit,
  patchHabitOptimistically,
} from "@/lib/habit-manager";
import type { Habit, HabitLog } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  HabitEditorDialog,
  habitTintClass,
  type HabitEditorValue,
} from "@/components/habits/HabitEditorDialog";
import {
  DAY_COMPLETE_BAR_CLASS,
  DAY_COMPLETE_CHECK_CLASS,
  DayCompleteAnnouncer,
  DayCompleteBadge,
  dayCompleteWave,
  useDayCompleteCelebration,
} from "@/components/habits/day-complete";

type HabitView = "today" | "history" | "archived";

interface MutationFailure {
  message: string;
  retry?: () => void | Promise<void>;
}

interface HabitManagerProps {
  userId: string;
  timezone: string;
  today: string;
  /** Opens the create form on mount; set by `/habits?new=1` (the + menu). */
  initiallyOpen?: boolean;
}

/** Drops `?new=1` once its form closes, so a reload does not reopen it. */
function clearNewHabitParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("new")) return;
  url.searchParams.delete("new");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof DuplicateHabitError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function HabitManager({
  userId,
  timezone,
  today,
  initiallyOpen = false,
}: HabitManagerProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [view, setView] = useState<HabitView>("today");
  const [historyDate, setHistoryDate] = useState(() => addDays(today, -1));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failure, setFailure] = useState<MutationFailure | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(initiallyOpen);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Habit | null>(null);
  const addXp = useUserStore((state) => state.addXp);
  const setCoins = useUserStore((state) => state.setCoins);
  const dayComplete = useDayCompleteCelebration(userId, today);

  // A tap on a card opens it, so dragging has to be told apart from tapping:
  // the mouse needs a few pixels of travel, a finger a long press (which
  // also leaves a normal swipe free to scroll the page). The keyboard drags
  // from the grip handle only; see SortableHabitCard.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  // Set for the length of a drag and one tick after it: the mouseup that
  // drops a card is followed by a click on it, which must not open it.
  const draggingRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [habitRows, logResult] = await Promise.all([
        fetchHabits(supabase, userId, true),
        supabase
          .from("habit_logs")
          .select("*")
          .eq("user_id", userId)
          .lte("log_date", today)
          .order("log_date", { ascending: true }),
      ]);
      if (logResult.error) throw logResult.error;
      setHabits(habitRows);
      setLogs((logResult.data ?? []) as HabitLog[]);
    } catch (error) {
      setLoadError(messageFromError(error, "Could not load your habits."));
    } finally {
      setLoading(false);
    }
  }, [supabase, today, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeHabits = useMemo(
    () => habits.filter((habit) => !habit.is_archived),
    [habits]
  );
  const archivedHabits = useMemo(
    () => habits.filter((habit) => habit.is_archived),
    [habits]
  );
  const logIndex = useMemo(() => indexHabitLogs(logs), [logs]);
  const doneToday = activeHabits.filter(
    (habit) => logIndex.get(habitLogKey(habit.id, today))?.completed
  ).length;
  const allDoneToday = activeHabits.length > 0 && doneToday === activeHabits.length;
  const visibleDate = view === "today" ? today : historyDate;
  const recentDates = useMemo(() => buildDateWindow(today, 14).reverse(), [today]);

  function setBusy(key: string, busy: boolean) {
    setBusyKeys((current) => {
      const next = new Set(current);
      if (busy) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function notifyUpdated() {
    window.dispatchEvent(new CustomEvent("lifequest-data-updated"));
    router.refresh();
  }

  async function saveCompletion(
    habit: Habit,
    date: string,
    completed: boolean,
    previousLog?: HabitLog
  ) {
    const key = habitLogKey(habit.id, date);
    if (busyKeys.has(key) || date > today) return;

    const optimisticLog: HabitLog = previousLog
      ? { ...previousLog, completed }
      : {
          id: `optimistic-${key}`,
          user_id: userId,
          habit_id: habit.id,
          entry_id: null,
          log_date: date,
          completed,
          created_at: new Date().toISOString(),
        };
    // Only ticking off today's last open habit completes the day; a past
    // day filled in from the history view does not.
    const wasCompleted = previousLog?.completed ?? false;
    const completesDay =
      date === today &&
      completesHabitDay({
        doneBefore: doneToday,
        doneAfter: doneToday + (completed && !wasCompleted ? 1 : 0) - (!completed && wasCompleted ? 1 : 0),
        total: activeHabits.length,
      });

    setFailure(null);
    setBusy(key, true);
    // With the optimistic log, so the wave starts on the tap itself.
    if (completesDay) dayComplete.celebrate();
    setLogs((current) => [
      ...current.filter(
        (log) => !(log.habit_id === habit.id && log.log_date === date)
      ),
      optimisticLog,
    ]);

    try {
      const savedLog = await setHabitLogCompletion(supabase, {
        existingLog: previousLog,
        userId,
        habitId: habit.id,
        date,
        completed,
      });
      setLogs((current) => [
        ...current.filter(
          (log) => !(log.habit_id === habit.id && log.log_date === date)
        ),
        savedLog,
      ]);
      try {
        // buildHabitSummary runs over the logs including the one just saved,
        // so currentStreak already counts this check-in -- which is the streak
        // applyHabitCheckInReward expects.
        const summary = buildHabitSummary({
          habit,
          logs: [...logs.filter((log) => log.habit_id === habit.id), savedLog],
          today,
          timezone,
        });
        const outcome = await applyHabitCheckInReward(supabase, {
          habitId: habit.id,
          date,
          completed,
          wasCompleted: previousLog?.completed ?? false,
          streak: summary.currentStreak,
          skillCategory: habit.skill_category ?? null,
        });
        if (outcome) {
          addXp(outcome.xpDelta, outcome.totalXp - outcome.xpDelta);
          setCoins(outcome.coins);
        }
      } catch (rewardError) {
        console.error("Failed to apply habit check-in reward", rewardError);
      }
      notifyUpdated();
    } catch (error) {
      if (completesDay) dayComplete.cancel();
      setLogs((current) => {
        const withoutOptimistic = current.filter(
          (log) => !(log.habit_id === habit.id && log.log_date === date)
        );
        return previousLog ? [...withoutOptimistic, previousLog] : withoutOptimistic;
      });
      setFailure({
        message: messageFromError(error, `Could not update ${habit.name}.`),
        retry: () => saveCompletion(habit, date, completed, previousLog),
      });
    } finally {
      setBusy(key, false);
    }
  }

  async function handleEditorSubmit(value: HabitEditorValue) {
    const mutationKey = editingHabit ? `edit-${editingHabit.id}` : "create";
    if (busyKeys.has(mutationKey)) return;
    if (hasDuplicateHabitName(habits, value.name, editingHabit?.id)) {
      setFailure({ message: "An active habit with this name already exists." });
      return;
    }

    setBusy(mutationKey, true);
    setFailure(null);
    try {
      if (editingHabit) {
        const next = {
          ...editingHabit,
          name: value.name.trim().replace(/\s+/g, " "),
          emoji: value.emoji,
          color: value.color,
          skill_category: value.skillCategory,
        };
        const transaction = patchHabitOptimistically(habits, next.id, next);
        setHabits(transaction.next);
        try {
          await updateHabit(supabase, editingHabit.id, {
            name: next.name,
            emoji: next.emoji,
            color: next.color,
            skill_category: next.skill_category,
          });
        } catch (error) {
          setHabits(transaction.rollback);
          throw error;
        }
      } else {
        const created = await createHabit(supabase, userId, {
          ...value,
          skillCategory: value.skillCategory,
          sortOrder: activeHabits.length,
        });
        setHabits((current) => [...current, created]);
      }
      setEditorOpen(false);
      setEditingHabit(null);
      notifyUpdated();
    } catch (error) {
      setFailure({
        message: messageFromError(error, "Could not save this habit."),
        retry: () => handleEditorSubmit(value),
      });
    } finally {
      setBusy(mutationKey, false);
    }
  }

  async function persistOrder(nextActive: Habit[], previousHabits: Habit[]) {
    if (busyKeys.has("reorder")) return;
    setBusy("reorder", true);
    setFailure(null);
    setHabits([...nextActive, ...previousHabits.filter((habit) => habit.is_archived)]);
    try {
      await Promise.all(
        nextActive.map((habit, index) =>
          updateHabit(supabase, habit.id, { sort_order: index })
        )
      );
      notifyUpdated();
    } catch (error) {
      setHabits(previousHabits);
      setFailure({
        message: messageFromError(error, "Could not save the new habit order."),
        retry: () => persistOrder(nextActive, previousHabits),
      });
    } finally {
      setBusy("reorder", false);
    }
  }

  function handleDragStart() {
    draggingRef.current = true;
  }

  function releaseDrag() {
    setTimeout(() => {
      draggingRef.current = false;
    }, 0);
  }

  function handleDragEnd(event: DragEndEvent) {
    releaseDrag();
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : activeId;
    const next = moveHabit(activeHabits, activeId, overId);
    if (next !== activeHabits) void persistOrder(next, habits);
  }

  async function setArchived(habit: Habit, isArchived: boolean) {
    const key = `${isArchived ? "archive" : "restore"}-${habit.id}`;
    if (busyKeys.has(key)) return;
    const nextHabit = { ...habit, is_archived: isArchived };
    const transaction = patchHabitOptimistically(habits, habit.id, nextHabit);
    setBusy(key, true);
    setFailure(null);
    setHabits(transaction.next);
    try {
      await updateHabit(supabase, habit.id, { is_archived: isArchived });
      setArchiveTarget(null);
      notifyUpdated();
    } catch (error) {
      setHabits(transaction.rollback);
      setFailure({
        message: messageFromError(
          error,
          isArchived ? "Could not archive this habit." : "Could not restore this habit."
        ),
        retry: () => setArchived(habit, isArchived),
      });
    } finally {
      setBusy(key, false);
    }
  }

  function startCreate() {
    setFailure(null);
    setEditingHabit(null);
    setEditorOpen(true);
  }

  function startEdit(habit: Habit) {
    if (draggingRef.current) return;
    setFailure(null);
    setEditingHabit(habit);
    setEditorOpen(true);
  }

  // The create button lives in the page header so it is reachable at the
  // top of the page on every width. It used to float at the bottom of the
  // list, where on a phone the fixed navigation covered it and took its taps.
  const header = (
    <PageHeader
      eyebrow={formatDateOnly(today, { weekday: "long", month: "long", day: "numeric" })}
      title="Habits"
      description={
        loading || loadError
          ? "Small daily actions, checked off once a day."
          : activeHabits.length === 0
            ? "Small daily actions, checked off once a day. Start with one."
            : allDoneToday
              ? <DayCompleteBadge celebrating={dayComplete.celebrating} />
              : `${doneToday} of ${activeHabits.length} done today`
      }
      actions={
        <Button size="lg" onClick={startCreate} disabled={loading} className="h-12 px-5">
          <Plus className="size-4" />
          Add habit
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="grid min-h-72 place-items-center rounded-2xl border bg-card">
          <div className="text-center" role="status">
            <Loader2 className="mx-auto size-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading habits…</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        {header}
        <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center">
          <p className="font-medium">Your habits could not be loaded.</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <Button className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <DayCompleteAnnouncer celebrating={dayComplete.celebrating} />
      {activeHabits.length > 0 && (
        <div
          role="progressbar"
          aria-label="Habits done today"
          aria-valuemin={0}
          aria-valuemax={activeHabits.length}
          aria-valuenow={doneToday}
          className="h-2 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-300",
              allDoneToday ? DAY_COMPLETE_BAR_CLASS : "bg-primary"
            )}
            style={{ width: `${Math.round((doneToday / activeHabits.length) * 100)}%` }}
          />
        </div>
      )}

      <div
        className="grid grid-cols-3 rounded-2xl border bg-muted/35 p-1"
        role="tablist"
        aria-label="Habit views"
      >
        {(
          [
            ["today", "Today", Check],
            ["history", "History", History],
            ["archived", "Archived", Archive],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              view === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {failure && !editorOpen && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-destructive">{failure.message}</p>
          <div className="flex gap-2">
            {failure.retry && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFailure(null);
                  void failure.retry?.();
                }}
              >
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setFailure(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {view === "history" && (
        <HistoryPicker
          today={today}
          selectedDate={historyDate}
          dates={recentDates}
          onChange={setHistoryDate}
        />
      )}

      {view === "archived" ? (
        <HabitListEmptyState
          visible={archivedHabits.length === 0}
          title="No archived habits"
          description="Habits you pause will stay here with their history intact."
        >
          <div className="space-y-3">
            {archivedHabits.map((habit) => (
              <ArchivedHabitCard
                key={habit.id}
                habit={habit}
                busy={busyKeys.has(`restore-${habit.id}`)}
                onRestore={() => void setArchived(habit, false)}
              />
            ))}
          </div>
        </HabitListEmptyState>
      ) : (
        <HabitListEmptyState
          visible={activeHabits.length === 0}
          title="No daily habits yet"
          description="Choose one behavior worth repeating and make it easy to check off."
          action={<Button onClick={startCreate}><Plus className="size-4" />Create habit</Button>}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={releaseDrag}
          >
            <SortableContext
              items={activeHabits.map((habit) => habit.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {activeHabits.map((habit, index) => {
                  const existingLog = logIndex.get(
                    habitLogKey(habit.id, visibleDate)
                  );
                  const createdDate = dateInTimezone(
                    new Date(habit.created_at),
                    timezone
                  );
                  const isDisabled = (checkDate: string) =>
                    busyKeys.has(habitLogKey(habit.id, checkDate)) ||
                    checkDate > today ||
                    checkDate < createdDate;
                  return (
                    <SortableHabitCard
                      key={habit.id}
                      habit={habit}
                      logs={logs}
                      timezone={timezone}
                      today={today}
                      date={visibleDate}
                      completed={existingLog?.completed ?? false}
                      dayComplete={visibleDate === today && allDoneToday}
                      waveIndex={index}
                      celebrating={dayComplete.celebrating}
                      isDisabled={isDisabled}
                      reorderDisabled={view !== "today" || busyKeys.has("reorder")}
                      onToggle={(completed) =>
                        void saveCompletion(
                          habit,
                          visibleDate,
                          completed,
                          existingLog
                        )
                      }
                      onEdit={() => startEdit(habit)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </HabitListEmptyState>
      )}


      <HabitEditorDialog
        open={editorOpen}
        habit={editingHabit}
        busy={busyKeys.has(editingHabit ? `edit-${editingHabit.id}` : "create")}
        error={failure?.message}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingHabit(null);
            clearNewHabitParam();
          }
        }}
        onSubmit={handleEditorSubmit}
        detailsHref={editingHabit ? `/habits/${editingHabit.id}` : undefined}
        // Hands over to the confirmation below rather than archiving from
        // here, so archiving stays a two-step action wherever it starts.
        onArchive={() => {
          const habit = editingHabit;
          setEditorOpen(false);
          setEditingHabit(null);
          setArchiveTarget(habit);
        }}
      />

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader className="pr-8">
            <DialogTitle className="leading-snug break-words">
              Archive {archiveTarget?.name}?
            </DialogTitle>

            <DialogDescription>
              Its check-in history stays available, and you can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                archiveTarget
                  ? busyKeys.has(`archive-${archiveTarget.id}`)
                  : false
              }
              onClick={() => {
                if (archiveTarget) void setArchived(archiveTarget, true);
              }}
            >
              Archive habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HabitListEmptyState({
  visible,
  title,
  description,
  action,
  children,
}: {
  visible: boolean;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!visible) return children;
  return (
    <div className="rounded-3xl border border-dashed bg-card/50 p-8 text-center">
      <CalendarDays className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function HistoryPicker({
  today,
  selectedDate,
  dates,
  onChange,
}: {
  today: string;
  selectedDate: string;
  dates: string[];
  onChange: (date: string) => void;
}) {
  return (
    <section className="space-y-3 rounded-3xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => onChange(addDays(selectedDate, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <label className="min-w-0 flex-1 text-center">
          <span className="sr-only">History date</span>
          <Input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) => {
              if (event.target.value && event.target.value <= today) {
                onChange(event.target.value);
              }
            }}
            className="mx-auto max-w-52 text-center"
          />
        </label>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={selectedDate >= today}
          onClick={() => onChange(addDays(selectedDate, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dates.map((date) => (
          <button
            key={date}
            type="button"
            aria-pressed={selectedDate === date}
            onClick={() => onChange(date)}
            className={cn(
              "min-w-14 rounded-xl border px-2 py-2 text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selectedDate === date
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 hover:bg-muted"
            )}
          >
            <span className="block text-[0.65rem] opacity-75">
              {formatDateOnly(date, { weekday: "short" })}
            </span>
            <span className="mt-0.5 block font-semibold">
              {formatDateOnly(date, { day: "numeric" })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface SortableHabitCardProps {
  habit: Habit;
  logs: HabitLog[];
  timezone: string;
  today: string;
  date: string;
  completed: boolean;
  /** Every active habit is done today and the card shows today. */
  dayComplete: boolean;
  /** The card's place in the list, for the day-complete wave. */
  waveIndex: number;
  celebrating: boolean;
  isDisabled: (date: string) => boolean;
  reorderDisabled: boolean;
  onToggle: (completed: boolean) => void;
  /** Opens the habit's editor, which also archives and links to its stats. */
  onEdit: () => void;
}

/**
 * One habit: the check-in circle, and the rest of the card as one button that
 * opens the habit. The whole card is also the drag source -- a long press on
 * touch, a short drag with the mouse -- while the grip is the keyboard's way
 * in. Only the pointer listeners go on the card: with the keyboard ones there
 * too, Enter or Space on the check-in circle would bubble up and pick the
 * card up instead of checking the habit off.
 */
function SortableHabitCard({
  habit,
  logs,
  timezone,
  today,
  date,
  completed,
  dayComplete,
  waveIndex,
  celebrating,
  isDisabled,
  reorderDisabled,
  onToggle,
  onEdit,
}: SortableHabitCardProps) {
  const reduceMotion = useReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id, disabled: reorderDisabled });
  const summary = buildHabitSummary({ habit, logs, today, timezone });
  const isToday = date === today;
  // Never checked in: the card asks for the first check-in instead of
  // showing a "0 day streak", which reads like a habit already missed.
  const isNew = !logs.some((log) => log.habit_id === habit.id && log.completed);
  // dnd-kit types its listeners as bare Functions; they are the sensors'
  // React event handlers (see the sensors in HabitManager).
  const pointerListeners = reorderDisabled
    ? undefined
    : {
        onMouseDown: listeners?.onMouseDown as React.MouseEventHandler | undefined,
        onTouchStart: listeners?.onTouchStart as React.TouchEventHandler | undefined,
      };

  return (
    <article
      ref={setNodeRef}
      {...pointerListeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }}
      className={cn(
        // select-none and no touch callout: a long press picks the card up
        // rather than selecting its text or opening the browser's menu.
        "rounded-3xl border bg-card p-4 transition-shadow select-none [-webkit-touch-callout:none]",
        isDragging && "z-20 shadow-xl ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={reorderDisabled}
          aria-label={`Drag ${habit.name} to reorder`}
          className="-ml-1 flex min-h-10 touch-none items-center text-muted-foreground hover:text-foreground disabled:opacity-25"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          role="checkbox"
          onClick={() => onToggle(!completed)}
          disabled={isDisabled(date)}
          aria-checked={completed}
          aria-label={
            isToday
              ? `${completed ? "Undo check-in for" : "Check in"} ${habit.name} today`
              : `${completed ? "Undo check-in for" : "Check in"} ${habit.name} on ${formatDateOnly(date, { month: "long", day: "numeric" })}`
          }
          className="group/check -m-1.5 grid size-11 shrink-0 place-items-center rounded-full outline-none disabled:cursor-not-allowed"
        >
          {/* Done is the filled primary circle with a tick, in every habit
              colour alike, so the state never depends on reading a hue. It
              turns green only once every habit is done today. */}
          <motion.span
            {...dayCompleteWave(waveIndex, celebrating, reduceMotion)}
            aria-hidden="true"
            className={cn(
              "grid size-8 place-items-center rounded-full border-2 transition-colors group-focus-visible/check:ring-3 group-focus-visible/check:ring-ring/50 group-disabled/check:opacity-45",
              completed
                ? dayComplete
                  ? DAY_COMPLETE_CHECK_CLASS
                  : "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/45 bg-transparent group-hover/check:border-primary"
            )}
          >
            {completed && <Check className="size-4" strokeWidth={3} />}
          </motion.span>
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${habit.name}`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-2xl text-xl",
              habitTintClass(habit.color)
            )}
          >
            {habit.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span
              title={habit.name}
              className={cn(
                "line-clamp-2 text-base leading-snug font-medium break-words",
                completed && isToday && "text-muted-foreground"
              )}
            >
              {habit.name}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <span>Daily</span>
              <span aria-hidden>·</span>
              {isNew ? (
                <span className="font-medium text-primary">
                  {isToday ? "Ready for its first check-in" : "No check-ins yet"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-3.5 text-orange-500" aria-hidden="true" />
                  {summary.currentStreak} day streak
                </span>
              )}
              {!isToday && (
                <>
                  <span aria-hidden>·</span>
                  {formatDateOnly(date, { month: "short", day: "numeric" })}
                </>
              )}
              {isToday && completed && (
                <>
                  <span aria-hidden>·</span>
                  <span>Done today</span>
                </>
              )}
            </span>

          </span>
        </button>
      </div>
    </article>
  );
}

function ArchivedHabitCard({
  habit,
  busy,
  onRestore,
}: {
  habit: Habit;
  busy: boolean;
  onRestore: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-xl text-lg",
          habitTintClass(habit.color)
        )}
      >
        {habit.emoji}
      </span>
      <div className="min-w-0 flex-1">
        {/* line-clamp (it sets its own display): on the inline link `truncate` did nothing and
            a long name ran underneath the Restore button. */}
        <Link
          href={`/habits/${habit.id}`}
          className="line-clamp-2 text-base leading-snug font-medium break-words hover:text-primary"
        >
          {habit.name}
        </Link>
        <p className="text-sm text-muted-foreground">History preserved</p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={onRestore}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        Restore
      </Button>
    </article>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
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
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  GripVertical,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
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
import {
  addDays,
  buildDateWindow,
  buildHabitSummary,
  dateInTimezone,
  formatDateOnly,
  habitLogKey,
  indexHabitLogs,
  moveHabit,
  moveHabitByOffset,
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
import {
  HabitEditorDialog,
  habitColorClass,
  type HabitEditorValue,
} from "@/components/habits/HabitEditorDialog";

type HabitView = "today" | "history" | "archived";

interface MutationFailure {
  message: string;
  retry?: () => void | Promise<void>;
}

interface HabitManagerProps {
  userId: string;
  timezone: string;
  today: string;
}

function messageFromError(error: unknown, fallback: string) {
  if (error instanceof DuplicateHabitError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function HabitManager({ userId, timezone, today }: HabitManagerProps) {
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Habit | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    setFailure(null);
    setBusy(key, true);
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
      notifyUpdated();
    } catch (error) {
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
        };
        const transaction = patchHabitOptimistically(habits, next.id, next);
        setHabits(transaction.next);
        try {
          await updateHabit(supabase, editingHabit.id, {
            name: next.name,
            emoji: next.emoji,
            color: next.color,
          });
        } catch (error) {
          setHabits(transaction.rollback);
          throw error;
        }
      } else {
        const created = await createHabit(supabase, userId, {
          ...value,
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

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : activeId;
    const next = moveHabit(activeHabits, activeId, overId);
    if (next !== activeHabits) void persistOrder(next, habits);
  }

  function moveWithButton(habitId: string, offset: -1 | 1) {
    const next = moveHabitByOffset(activeHabits, habitId, offset);
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
    setFailure(null);
    setEditingHabit(habit);
    setEditorOpen(true);
  }

  const doneToday = activeHabits.filter(
    (habit) => logIndex.get(habitLogKey(habit.id, today))?.completed
  ).length;

  if (loading) {
    return (
      <div className="grid min-h-72 place-items-center rounded-3xl border bg-card">
        <div className="text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading habits…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-6 text-center">
        <p className="font-medium">Your habits could not be loaded.</p>
        <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        <Button className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border bg-card">
        <div className="bg-gradient-to-br from-primary/12 via-background to-orange-500/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {formatDateOnly(today, { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p className="mt-1 font-heading text-3xl font-semibold tracking-tight">
                {activeHabits.length === 0
                  ? "Start small"
                  : `${doneToday} of ${activeHabits.length} done`}
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-background/80 shadow-sm">
              <Flame className="size-5 text-orange-500" />
            </span>
          </div>
          {activeHabits.length > 0 && (
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.round((doneToday / activeHabits.length) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </section>

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

      {failure && (
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
            onDragEnd={handleDragEnd}
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
                      isDisabled={isDisabled}
                      reorderDisabled={view !== "today" || busyKeys.has("reorder")}
                      canMoveUp={index > 0}
                      canMoveDown={index < activeHabits.length - 1}
                      onToggle={(completed) =>
                        void saveCompletion(
                          habit,
                          visibleDate,
                          completed,
                          existingLog
                        )
                      }
                      onEdit={() => startEdit(habit)}
                      onArchive={() => setArchiveTarget(habit)}
                      onMove={(offset) => moveWithButton(habit.id, offset)}
                      onToggleDate={(toggleDate, completed) =>
                        void saveCompletion(
                          habit,
                          toggleDate,
                          completed,
                          logIndex.get(habitLogKey(habit.id, toggleDate))
                        )
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </HabitListEmptyState>
      )}

      {view !== "archived" && activeHabits.length > 0 && (
        <div className="sticky bottom-[calc(0.75rem+var(--safe-area-bottom))] z-10 flex justify-end">
          <Button
            size="lg"
            onClick={startCreate}
            className="min-h-12 rounded-full px-5 shadow-lg"
          >
            <Plus className="size-4" />
            Add habit
          </Button>
        </div>
      )}

      <HabitEditorDialog
        open={editorOpen}
        habit={editingHabit}
        busy={busyKeys.has(editingHabit ? `edit-${editingHabit.id}` : "create")}
        error={failure?.message}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingHabit(null);
        }}
        onSubmit={handleEditorSubmit}
      />

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {archiveTarget?.name}?</DialogTitle>
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
  isDisabled: (date: string) => boolean;
  reorderDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: (completed: boolean) => void;
  onEdit: () => void;
  onArchive: () => void;
  onMove: (offset: -1 | 1) => void;
  onToggleDate: (date: string, completed: boolean) => void;
}

function SortableHabitCard({
  habit,
  logs,
  timezone,
  today,
  date,
  completed,
  isDisabled,
  reorderDisabled,
  canMoveUp,
  canMoveDown,
  onToggle,
  onEdit,
  onArchive,
  onMove,
  onToggleDate,
}: SortableHabitCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id, disabled: reorderDisabled });
  const summary = buildHabitSummary({ habit, logs, today, timezone });
  const week = buildDateWindow(today, 7);
  const isToday = date === today;

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
      }}
      className={cn(
        "rounded-3xl border bg-card p-4 transition-shadow",
        isDragging && "z-20 shadow-xl ring-2 ring-primary/20"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={reorderDisabled}
          aria-label={`Drag ${habit.name} to reorder`}
          className="mt-1 hidden min-h-10 touch-none items-center text-muted-foreground hover:text-foreground disabled:opacity-25 sm:flex"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onToggle(!completed)}
          disabled={isDisabled(date)}
          aria-pressed={completed}
          aria-label={`Mark ${habit.name} ${completed ? "incomplete" : "complete"} for ${date}`}
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl text-xl text-white shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45",
            habitColorClass(habit.color),
            completed && "scale-[0.96]"
          )}
        >
          {completed ? <Check className="size-5" /> : habit.emoji}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/habits/${habit.id}`}
                title={habit.name}
                className={cn(
                  "block truncate font-medium hover:text-primary",
                  completed && isToday && "text-muted-foreground"
                )}
              >
                {habit.name}
              </Link>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Flame className="size-3 text-orange-500" />
                {summary.currentStreak} day streak
                {!isToday && (
                  <>
                    <span aria-hidden>·</span>
                    {formatDateOnly(date, { month: "short", day: "numeric" })}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                aria-label={`Edit ${habit.name}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onArchive}
                aria-label={`Archive ${habit.name}`}
              >
                <Archive className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label={`${habit.name} last seven days`}>
            {week.map((day) => {
              const dayCompleted = summary.completionDates.has(day);
              const dayLabel = formatDateOnly(day, {
                weekday: "long",
                month: "short",
                day: "numeric",
              });
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled(day)}
                  title={dayLabel}
                  aria-pressed={dayCompleted}
                  aria-label={`Mark ${habit.name} ${dayCompleted ? "incomplete" : "complete"} for ${dayLabel}`}
                  onClick={() => onToggleDate(day, !dayCompleted)}
                  className={cn(
                    "aspect-square rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                    dayCompleted
                      ? cn("border-transparent", habitColorClass(habit.color))
                      : "border-border bg-muted/45",
                    day === today && "ring-2 ring-foreground/40 ring-offset-2 ring-offset-card"
                  )}
                />
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t pt-3 sm:hidden">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MoreHorizontal className="size-3.5" />
              Reorder
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={reorderDisabled || !canMoveUp}
                onClick={() => onMove(-1)}
                aria-label={`Move ${habit.name} up`}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={reorderDisabled || !canMoveDown}
                onClick={() => onMove(1)}
                aria-label={`Move ${habit.name} down`}
              >
                <ArrowDown className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
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
          "grid size-11 shrink-0 place-items-center rounded-xl text-lg text-white",
          habitColorClass(habit.color)
        )}
      >
        {habit.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/habits/${habit.id}`} className="truncate font-medium hover:text-primary">
          {habit.name}
        </Link>
        <p className="text-xs text-muted-foreground">History preserved</p>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={onRestore}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
        Restore
      </Button>
    </article>
  );
}

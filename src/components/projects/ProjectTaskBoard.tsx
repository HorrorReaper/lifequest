"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TASK_COLUMNS, orderedRoots } from "@/lib/projects/project-workspace";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type BoardProps = {
  tasks: Task[];
  busy: boolean;
  onMove: (task: Task, status: TaskStatus, beforeId: string | null) => void;
  onEdit: (task: Task) => void;
  onDetach: (task: Task) => void;
  onDelete: (task: Task) => void;
};
export function ProjectTaskBoard(props: BoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const roots = orderedRoots(props.tasks).filter(
    (task) => task.status !== "cancelled",
  );
  function drop(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over || event.active.id === event.over.id || props.busy) return;
    const task = roots.find((task) => task.id === event.active.id);
    const target = roots.find((task) => task.id === event.over?.id);
    const column = TASK_COLUMNS.find(
      (column) => `column:${column.status}` === event.over?.id,
    );
    if (task && (target || column)) {
      // A downward drop in the same column inserts after the hovered card.
      const status = target?.status ?? column!.status;
      const items = roots.filter((item) => item.status === status);
      const movingDown =
        target &&
        task.status === status &&
        items.indexOf(task) < items.indexOf(target);
      const before = movingDown
        ? (items[items.indexOf(target) + 1]?.id ?? null)
        : (target?.id ?? null);
      props.onMove(task, status, before);
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={drop}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press space to pick up a task. Use arrow keys to move, space to drop, or escape to cancel.",
        },
      }}
    >
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[76rem] grid-cols-5 gap-4">
          {TASK_COLUMNS.map((column) => (
            <BoardColumn
              key={column.status}
              column={column}
              items={roots.filter((task) => task.status === column.status)}
              props={props}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeId && (
          <div className="max-w-64 rounded-xl border bg-card p-4 shadow-xl">
            {roots.find((task) => task.id === activeId)?.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
function BoardColumn({
  column,
  items,
  props,
}: {
  column: (typeof TASK_COLUMNS)[number];
  items: Task[];
  props: BoardProps;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.status}`,
    disabled: props.busy,
  });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.label}
      className={cn(
        "min-h-64 rounded-2xl bg-muted/40 p-3",
        isOver && "ring-2 ring-primary",
      )}
    >
      <h3 className="mb-3 flex justify-between text-sm font-semibold">
        {column.label}
        <span className="text-muted-foreground">{items.length}</span>
      </h3>
      <SortableContext
        items={items.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {items.map((task) => (
            <SortableTask key={task.id} task={task} props={props} />
          ))}
          {!items.length && (
            <p className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
              Drop a task here
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
function SortableTask({ task, props }: { task: Task; props: BoardProps }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: props.busy });
  const children = props.tasks.filter(
    (item) => item.parent_task_id === task.id,
  );
  const siblings = orderedRoots(props.tasks).filter(
    (item) => item.status === task.status,
  );
  const position = siblings.findIndex((item) => item.id === task.id);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={props.busy}
          aria-label={`Drag ${task.title}`}
          className="touch-none rounded p-1 text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={() => props.onEdit(task)}
          className={cn(
            "min-w-0 flex-1 break-words py-1 text-left text-sm font-medium hover:text-primary",
            task.status === "done" && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Actions for ${task.title}`}
                disabled={props.busy}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => props.onEdit(task)}>
              Edit task / change project
            </DropdownMenuItem>
            {TASK_COLUMNS.filter((column) => column.status !== task.status).map(
              (column) => (
                <DropdownMenuItem
                  key={column.status}
                  onClick={() => props.onMove(task, column.status, null)}
                >
                  Move to {column.label}
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuItem
              disabled={position === 0}
              onClick={() =>
                props.onMove(
                  task,
                  task.status,
                  siblings[position - 1]?.id ?? null,
                )
              }
            >
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={position === siblings.length - 1}
              onClick={() =>
                props.onMove(
                  task,
                  task.status,
                  siblings[position + 2]?.id ?? null,
                )
              }
            >
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onDetach(task)}>
              Remove from project
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => props.onDelete(task)}
            >
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1">{task.priority}</span>
        {task.due_date && <span className="py-1">{task.due_date}</span>}
        {children.length > 0 && (
          <span className="py-1">
            {children.filter((item) => item.is_completed).length}/
            {children.length} subtasks
          </span>
        )}
        {task.estimate_minutes && (
          <span className="py-1">{task.estimate_minutes} min</span>
        )}
      </div>
      {task.status === "blocked" && task.blocked_reason && (
        <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          {task.blocked_reason}
        </p>
      )}
    </article>
  );
}

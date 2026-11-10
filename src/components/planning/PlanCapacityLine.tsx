import { formatPlanMinutes, type TodayPlanCapacity } from "@/lib/today-plan";
import { cn } from "@/lib/utils";

interface PlanCapacityLineProps {
  capacity: TodayPlanCapacity;
  /** Whether some blocks overlap, so the reader knows they counted once. */
  hasOverlap?: boolean;
  className?: string;
}

/**
 * "2h 15m scheduled · 7h 45m unplanned" in one quiet line.
 *
 * Replaces a capacity card beside the timeline. Unplanned time is described
 * neutrally -- it is room, not a shortfall. Only time planned outside the
 * day hours is marked, because that is the part that does not fit.
 */
export function PlanCapacityLine({
  capacity,
  hasOverlap = false,
  className,
}: PlanCapacityLineProps) {
  const scheduled = capacity.plannedMinutes - capacity.outsideMinutes;
  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-1.5 text-sm text-muted-foreground",
        className
      )}
    >
      <strong className="font-medium text-foreground">
        {formatPlanMinutes(scheduled)} scheduled
      </strong>
      <span>· {formatPlanMinutes(capacity.remainingMinutes)} unplanned</span>
      {capacity.outsideMinutes > 0 && (
        <span className="font-medium text-amber-800 dark:text-amber-200">
          · {formatPlanMinutes(capacity.outsideMinutes)} outside your day hours
        </span>
      )}
      {hasOverlap && <span>· overlapping time counted once</span>}
    </p>
  );
}

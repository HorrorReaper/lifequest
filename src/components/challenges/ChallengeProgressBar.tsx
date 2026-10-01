import { cn } from '@/lib/utils'

export function ChallengeProgressBar({
  completed,
  total,
  className,
}: {
  completed: number
  total: number
  className?: string
}) {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completed} of {total} days
        </span>
        <span className="font-mono">{percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-label="Challenge progress"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

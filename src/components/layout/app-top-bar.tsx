import { Coins, Flame } from 'lucide-react'
import { getLevel, getXpProgress } from '@/lib/gamification'
import type { ShellStats } from '@/lib/shell-stats'

/**
 * Level, XP, coins and streak, on every page with the standard shell.
 *
 * Sticky rather than fixed, and offset by `--preview-banner-height` (set by
 * the (app) layout only while an admin previews as a user): the preview
 * banner is itself `sticky top-0`, and a bar pinned to the same edge would
 * slide out of sight behind it.
 *
 * Presentational on purpose -- `AppShell` feeds it live values -- and built
 * from theme tokens, so it follows White, System, Dark and Trail.
 */
export function AppTopBar({ stats }: { stats: ShellStats }) {
  const level = getLevel(stats.totalXp)
  const progress = getXpProgress(stats.totalXp)
  // Below zero for a brand-new account: level 1 starts above 0 XP, so the
  // raw figure is negative until the first level-up threshold is crossed.
  const pct = Math.min(100, Math.max(0, progress.pct))

  return (
    <div
      role="group"
      aria-label="Your progress"
      className="sticky top-[var(--preview-banner-height,0px)] z-40 border-b border-border/50 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="mx-auto flex h-12 max-w-2xl items-center gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-sm font-semibold tabular-nums">Lv {level}</span>
          <div className="min-w-0 flex-1">
            <div
              role="progressbar"
              aria-label={`XP progress to level ${level + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-0.5 truncate text-[10px] leading-none tabular-nums text-muted-foreground">
              {stats.totalXp} / {progress.next} XP
            </p>
          </div>
        </div>

        <span
          className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums"
          aria-label={`${stats.coins} coins`}
        >
          <Coins className="size-4 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
          {stats.coins}
        </span>
        <span
          className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums"
          aria-label={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'} streak`}
        >
          <Flame className="size-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
          {stats.streak}
        </span>
      </div>
    </div>
  )
}

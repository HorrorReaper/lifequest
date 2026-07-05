'use client'

import Link from 'next/link'
import { Trophy, Zap, Coins, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DefaultQuestWithStatus, CustomQuest } from '@/lib/quests'
import { cn } from '@/lib/utils'

interface QuestDashboardWidgetProps {
  claimable: DefaultQuestWithStatus[]
  activeCustom: CustomQuest[]
}

export function QuestDashboardWidget({ claimable, activeCustom }: QuestDashboardWidgetProps) {
  const items = [
    ...claimable.slice(0, 3).map((q) => ({
      key: q.key,
      title: q.title,
      xp: q.xp,
      coins: q.coins,
      badge: 'Ready to claim',
      badgeClass: 'text-primary',
    })),
    ...activeCustom.slice(0, 2).map((q) => ({
      key: q.id,
      title: q.title,
      xp: q.xp_reward,
      coins: q.coin_reward,
      badge: 'My quest',
      badgeClass: 'text-muted-foreground',
    })),
  ]

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Quests</h2>
          {claimable.length > 0 && (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {claimable.length}
            </span>
          )}
        </div>
        <Link
          href="/quests"
          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ChevronRight className="size-3" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-muted-foreground">No active quests</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/quests">Browse Quests</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className={cn('text-[10px]', item.badgeClass)}>{item.badge}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-0.5 text-[11px] text-blue-600 dark:text-blue-400">
                  <Zap className="size-3" />{item.xp}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] text-yellow-600 dark:text-yellow-400">
                  <Coins className="size-3" />{item.coins}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

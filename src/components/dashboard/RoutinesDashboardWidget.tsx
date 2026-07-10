import Link from 'next/link'
import { Play, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface DashboardRoutine {
  id: string
  name: string
  emoji: string
  description: string | null
  completed: number
  total: number
}

interface RoutinesDashboardWidgetProps {
  routines: DashboardRoutine[]
}

export function RoutinesDashboardWidget({ routines }: RoutinesDashboardWidgetProps) {
  return (
    <Card className="border-primary/15 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          Today&apos;s Routines
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {routines.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-background/70 p-4 text-center">
            <p className="text-sm font-medium">No routines yet</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Chain existing habits into a morning ritual, focus starter, or evening shutdown.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/settings">Create a routine</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {routines.slice(0, 3).map((routine) => {
              const pct = routine.total > 0 ? Math.round((routine.completed / routine.total) * 100) : 0
              const complete = routine.total > 0 && routine.completed >= routine.total

              return (
                <div key={routine.id} className="rounded-xl border bg-background/80 p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{routine.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">{routine.name}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {routine.completed}/{routine.total}
                        </span>
                      </div>
                      {routine.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {routine.description}
                        </p>
                      )}
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <Button asChild size="sm" className="mt-3 w-full" variant={complete ? 'outline' : 'default'}>
                    <Link href={`/routines/${routine.id}/run`}>
                      <Play className="size-3.5" />
                      {complete ? 'Review Routine' : 'Run Routine'}
                    </Link>
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

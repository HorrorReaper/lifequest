'use client'

import { useState } from 'react'
import { CalendarDays, Check, Coins, LockKeyhole, Play, Zap } from 'lucide-react'
import type { ChallengeProgram } from '@/lib/quests'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function utcDayDifference(later: string, earlier: string) {
  return Math.floor((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000)
}

export function ChallengeProgramCard({ program, onStart, onRestart, onCompleteDay }: {
  program: ChallengeProgram
  onStart: (program: ChallengeProgram) => Promise<void>
  onRestart: (program: ChallengeProgram) => Promise<void>
  onCompleteDay: (program: ChallengeProgram, note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { template, enrollment, progress } = program
  const completedDays = new Set(progress.map((item) => item.day_number)).size
  const complete = enrollment?.status === 'completed'
  const currentDayNumber = Math.min(completedDays + 1, template.duration_days)
  const currentDay = program.days.find((day) => day.day_number === currentDayNumber)
  const checkedToday = progress.some((item) => item.completed_on === todayKey())
  const strictMissed = Boolean(enrollment && template.schedule_mode === 'strict' && !complete && utcDayDifference(todayKey(), enrollment.start_date) + 1 > currentDayNumber)
  const percent = Math.round((completedDays / template.duration_days) * 100)

  async function run(action: () => Promise<void>) {
    setWorking(true); setError(null)
    try { await action() } catch (err) { setError(err instanceof Error ? err.message : 'Could not update this challenge.') }
    finally { setWorking(false) }
  }

  return <article className={cn('overflow-hidden rounded-[1.5rem] border bg-card', complete && 'opacity-70')}>
    <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{template.duration_days}-day program</span><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] capitalize text-muted-foreground">{template.schedule_mode}</span></div><h2 className="mt-3 text-xl font-semibold tracking-tight">{template.title}</h2>{template.description && <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{template.description}</p>}</div>
        <div className="flex shrink-0 gap-3 text-xs"><span className="flex items-center gap-1 text-blue-600 dark:text-blue-400"><Zap className="size-3.5" />{template.xp_reward}</span><span className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><Coins className="size-3.5" />{template.coin_reward}</span></div>
      </div>

      {!enrollment ? <div className="mt-6 rounded-2xl bg-muted/40 p-4"><p className="text-sm font-medium">A different practical action unlocks each day.</p><p className="mt-1 text-xs text-muted-foreground">{template.schedule_mode === 'strict' ? 'Strict mode requires an unbroken daily streak.' : 'Sequential mode lets you progress at a sustainable pace, one day at a time.'}</p><Button className="mt-4" onClick={() => run(() => onStart(program))} disabled={working}><Play />{working ? 'Starting...' : 'Start challenge'}</Button></div> : <>
        <div className="mt-6"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{complete ? 'Journey completed' : `Day ${currentDayNumber} of ${template.duration_days}`}</span><span className="font-mono">{completedDays}/{template.duration_days}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div></div>

        {complete ? <div className="mt-5 flex items-center gap-3 rounded-2xl bg-primary/10 p-4 text-primary"><span className="grid size-10 place-items-center rounded-full bg-background"><Check className="size-5" /></span><div><p className="font-medium">Challenge complete</p><p className="text-xs opacity-75">All daily actions have been completed.</p></div></div> : currentDay && <div className="mt-5 rounded-2xl bg-muted/40 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background font-mono text-xs">{String(currentDay.day_number).padStart(2, '0')}</span><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Today’s challenge</p><h3 className="mt-1 font-semibold">{currentDay.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{currentDay.instructions}</p></div></div>{currentDay.reflection_prompt && !strictMissed && <div className="mt-4"><p className="mb-2 text-xs text-muted-foreground">{currentDay.reflection_prompt}</p><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional reflection note" /></div>}{strictMissed && <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">A calendar day was missed. Restart to begin a new strict streak without deleting the previous attempt.</p>}<Button className="mt-4 w-full sm:w-auto" onClick={() => run(async () => { if (strictMissed) await onRestart(program); else { await onCompleteDay(program, note); setNote('') } })} disabled={working || checkedToday}>{strictMissed ? <><LockKeyhole />{working ? 'Restarting...' : 'Restart challenge'}</> : checkedToday ? <><Check />Done today</> : <><CalendarDays />{working ? 'Saving...' : 'Complete today’s challenge'}</>}</Button></div>}
      </>}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  </article>
}

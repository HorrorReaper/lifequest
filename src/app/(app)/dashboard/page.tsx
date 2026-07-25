import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLevel, getCityTier, getXpProgress, CITY_TIER_LABELS } from '@/lib/gamification'
import { getLockedBuildings } from '@/lib/city'
import type { Database } from '@/lib/supabase/database.types'
import { DashboardHero } from '@/components/dashboard/DashboardHero'
import { NextRewardCard } from '@/components/dashboard/NextRewardCard'
import { QuestDashboardWidget } from '@/components/quests/QuestDashboardWidget'
import { fetchQuestPageData } from '@/lib/quests'
import { DailyBriefingWidget } from '@/components/dashboard/DailyBriefingWidget'
import type { DayPlanBlock } from '@/lib/types'
import { fetchGoals } from '@/lib/goals'
import { calculateRoutineProgress, fetchRoutines } from '@/lib/routines'
import { RoutinesDashboardWidget } from '@/components/dashboard/RoutinesDashboardWidget'
import { isAdminUser } from '@/lib/admin'

type QuickActionTarget = 'task' | 'plan' | 'habit' | 'goal' | 'routine'

interface DashboardPageProps {
  searchParams?: Promise<{
    quick?: string | string[]
  }>
}

function parseQuickAction(value: string | string[] | undefined): QuickActionTarget | null {
  const quick = Array.isArray(value) ? value[0] : value
  if (quick === 'task' || quick === 'plan' || quick === 'habit' || quick === 'goal' || quick === 'routine') {
    return quick
  }
  return null
}

function dateInTimezone(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function dayLabel(timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date())
}

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function currentMinutesInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? 0)
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? 0)
  return hours * 60 + minutes
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {}
  const quickAction = parseQuickAction(params.quick)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = data as Database['public']['Tables']['profiles']['Row'] | null

  if (!profile?.onboarding_complete) redirect('/onboarding')

  const isAdmin = isAdminUser(user)

  const level = getLevel(profile.total_xp)
  const cityTier = getCityTier(level)
  const progress = getXpProgress(profile.total_xp)

  const { data: cityRowData } = await supabase
    .from('city_states')
    .select('coins')
    .eq('user_id', user.id)
    .single()
  const coins = (cityRowData as { coins: number } | null)?.coins ?? 0

  const lockedBuildings = getLockedBuildings(profile.total_xp)
  const nextBuilding = [...lockedBuildings].sort((a, b) => a.xpRequired - b.xpRequired)[0] ?? null

  const { annotated, customQuests } = await fetchQuestPageData(supabase, user.id)
  const claimableQuests = annotated.filter((q) => q.status === 'claimable')
  const activeCustomQuests = customQuests.filter((q) => !q.is_completed)
  const activeGoals = isAdmin
    ? await fetchGoals(supabase, user.id, { status: 'active' })
    : []
  const today = dateInTimezone(profile.timezone ?? 'UTC')

  const [
    briefingHabitsRes,
    briefingHabitLogsRes,
    briefingTasksRes,
    briefingTemplatesRes,
    todayEntriesRes,
    dayPlanRes,
    routines,
  ] = await Promise.all([
    supabase
      .from('habits')
      .select('id, name, emoji')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', user.id)
      .eq('log_date', today)
      .eq('completed', true),
    supabase
      .from('tasks')
      .select('id, title, due_date, priority')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .or(`due_date.lte.${today},due_date.is.null`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('journal_templates')
      .select('id, name, icon')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .eq('is_active', true)
      .order('sort_order')
      .limit(6),
    supabase
      .from('journal_entries')
      .select('id, template_id')
      .eq('user_id', user.id)
      .eq('entry_date', today)
      .eq('is_complete', true),
    supabase
      .from('day_plans')
      .select('blocks')
      .eq('user_id', user.id)
      .eq('plan_date', today)
      .maybeSingle(),
    isAdmin ? fetchRoutines(supabase, user.id, false) : Promise.resolve([]),
  ])

  const completedHabitIds = new Set(
    ((briefingHabitLogsRes.data ?? []) as { habit_id: string }[]).map((log) => log.habit_id)
  )
  const briefingHabits = ((briefingHabitsRes.data ?? []) as {
    id: string
    name: string
    emoji: string | null
  }[]).map((habit) => ({
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji ?? '✅',
    completed: completedHabitIds.has(habit.id),
  }))
  const briefingTasks = ((briefingTasksRes.data ?? []) as {
    id: string
    title: string
    due_date: string | null
    priority: 'low' | 'medium' | 'high' | null
  }[]).map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.due_date,
    priority: task.priority ?? 'medium',
    isOverdue: task.due_date !== null && task.due_date < today,
  }))
  const completedTemplateIds = new Set(
    ((todayEntriesRes.data ?? []) as { template_id: string }[]).map((entry) => entry.template_id)
  )
  const briefingJournals = ((briefingTemplatesRes.data ?? []) as {
    id: string
    name: string
    icon: string | null
  }[]).map((template) => ({
    id: template.id,
    name: template.name,
    icon: template.icon ?? '📓',
    completedToday: completedTemplateIds.has(template.id),
  }))
  const nowMinutes = currentMinutesInTimezone(profile.timezone ?? 'UTC')
  const planBlocks = (((dayPlanRes.data as { blocks?: DayPlanBlock[] } | null)?.blocks ?? [])
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((block) => {
      const start = minutesFromTime(block.start_time)
      const end = minutesFromTime(block.end_time)
      return {
        id: block.id,
        startTime: block.start_time,
        endTime: block.end_time,
        title: block.title,
        category: block.category,
        isCurrent: start <= nowMinutes && end > nowMinutes,
        isPast: end <= nowMinutes,
      }
    }))
  const dashboardRoutines = routines
    .filter((routine) => routine.items.length > 0)
    .map((routine) => {
      const progress = calculateRoutineProgress(routine, completedHabitIds)

      return {
        id: routine.id,
        name: routine.name,
        emoji: routine.emoji,
        description: routine.description,
        completed: progress.completed,
        total: progress.total,
      }
    })

  return (
    <div className="min-h-svh bg-background p-4 pb-20 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <DashboardHero
          username={profile.username}
          level={level}
          cityTierLabel={CITY_TIER_LABELS[cityTier]}
          xpNext={progress.next}
          totalXp={profile.total_xp}
          pct={progress.pct}
          coins={coins}
          streak={profile.current_streak}
        />

        <DailyBriefingWidget
          key={`briefing-${quickAction ?? 'default'}`}
          userId={user.id}
          todayDate={today}
          todayLabel={dayLabel(profile.timezone ?? 'UTC')}
          habits={briefingHabits}
          tasks={briefingTasks}
          journals={briefingJournals}
          planBlocks={planBlocks}
          goals={activeGoals}
          goalsEnabled={isAdmin}
          completedJournalCount={(todayEntriesRes.data ?? []).length}
          routinesEnabled={isAdmin}
          initialOpenPanel={
            quickAction === 'routine'
              ? (isAdmin ? 'routine' : null)
              : quickAction === 'goal'
                ? (isAdmin ? 'goal' : null)
              : quickAction === 'plan' || quickAction === 'task' || quickAction === 'habit'
              ? quickAction
              : null
          }
        />

        {isAdmin && <RoutinesDashboardWidget routines={dashboardRoutines} />}

        <NextRewardCard building={nextBuilding} currentXp={profile.total_xp} />

        <QuestDashboardWidget
          claimable={claimableQuests}
          activeCustom={activeCustomQuests}
        />
      </div>
    </div>
  )
}

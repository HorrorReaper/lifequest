import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addDays, dateInTimezone } from '@/lib/dates'
import { getLevel, getCityTier, getXpProgress, CITY_TIER_LABELS } from '@/lib/gamification'
import type { Database } from '@/lib/supabase/database.types'
import { ThemedDashboardHero } from '@/components/dashboard/ThemedDashboardHero'
import { TrailPageSpine } from '@/components/dashboard/TrailPageSpine'
import { JournalNudge } from '@/components/dashboard/JournalNudge'
import { HabitsSection } from '@/components/dashboard/HabitsSection'
import { TasksSection } from '@/components/dashboard/TasksSection'
import {
  buildDashboardHabits,
  completedHabitIdsFor,
  habitStreakWindowStart,
  type HabitLogRow,
  type HabitRow,
} from '@/lib/dashboard-habits'
import {
  DASHBOARD_TASK_FETCH_LIMIT,
  partitionDashboardTasks,
  type TaskRow,
} from '@/lib/dashboard-tasks'
import { fetchAvatarState } from '@/lib/avatar'
import { QuestDashboardWidget } from '@/components/quests/QuestDashboardWidget'
import { fetchQuestPageData } from '@/lib/quests'
import { DailyBriefingWidget } from '@/components/dashboard/DailyBriefingWidget'
import type { DayPlanBlock } from '@/lib/types'
import { fetchGoals } from '@/lib/goals'
import { calculateRoutineProgress, fetchRoutines } from '@/lib/routines'
import { RoutinesDashboardWidget } from '@/components/dashboard/RoutinesDashboardWidget'
import { showAdminUi } from '@/lib/admin'
import { fetchDashboardLearnings } from '@/lib/dashboard-learnings'
import { AdminLearningWidget } from '@/components/dashboard/AdminLearningWidget'
import { parseTodayPlanNotes } from '@/lib/today-plan'
import { FirstRunWelcome } from '@/components/dashboard/FirstRunWelcome'
import { DailyPlanPrompt } from '@/components/dashboard/DailyPlanPrompt'
import { EveningReviewPrompt } from '@/components/dashboard/EveningReviewPrompt'
import { fetchMetricSeries, fetchTrackedMetrics } from '@/lib/metrics'
import { MetricDashboardWidget } from '@/components/dashboard/MetricDashboardWidget'

type QuickActionTarget = 'task' | 'plan' | 'habit' | 'goal' | 'routine'

interface DashboardPageProps {
  searchParams?: Promise<{
    quick?: string | string[]
    welcome?: string
  }>
}

function parseQuickAction(value: string | string[] | undefined): QuickActionTarget | null {
  const quick = Array.isArray(value) ? value[0] : value
  if (quick === 'task' || quick === 'plan' || quick === 'habit' || quick === 'goal' || quick === 'routine') {
    return quick
  }
  return null
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
  const showWelcome = params.welcome === '1'
  if (quickAction === 'plan') redirect('/plan')
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

  const isAdmin = await showAdminUi(user)

  const level = getLevel(profile.total_xp)
  const cityTier = getCityTier(level)
  const progress = getXpProgress(profile.total_xp)

  const [{ data: cityRowData }, avatarState] = await Promise.all([
    supabase.from('city_states').select('coins').eq('user_id', user.id).single(),
    fetchAvatarState(supabase, user.id),
  ])
  const coins = (cityRowData as { coins: number } | null)?.coins ?? 0

  const { annotated, customQuests } = await fetchQuestPageData(supabase, user.id)
  const claimableQuests = annotated.filter((q) => q.status === 'claimable')
  const activeCustomQuests = customQuests.filter((q) => !q.is_completed)
  const activeGoals = isAdmin
    ? await fetchGoals(supabase, user.id, { status: 'active' })
    : []
  const today = dateInTimezone(new Date(), profile.timezone ?? 'UTC')

  const trackedMetrics = await fetchTrackedMetrics(supabase, user.id)
  const trackedMetricSeries = await Promise.all(
    trackedMetrics.map((metric) => fetchMetricSeries(supabase, user.id, metric.fieldId))
  )
  // Prefer a metric that actually has data over the first one alphabetically/
  // by creation order, so a brand-new, still-empty metric doesn't bump one
  // the user is already filling in off the dashboard.
  const primaryMetricIndex = trackedMetricSeries.findIndex((series) => series.length > 0)
  const primaryMetric =
    primaryMetricIndex >= 0 ? trackedMetrics[primaryMetricIndex] : trackedMetrics[0] ?? null
  const primaryMetricSeries =
    primaryMetricIndex >= 0 ? trackedMetricSeries[primaryMetricIndex] : []

  const [
    briefingHabitsRes,
    briefingHabitLogsRes,
    briefingTasksRes,
    briefingTemplatesRes,
    todayEntriesRes,
    dayPlanRes,
    routines,
    dashboardLearnings,
    openTasksRes,
    tasksCompletedTodayRes,
  ] = await Promise.all([
    supabase
      .from('habits')
      .select('id, name, emoji, skill_category')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    // Widened from today-only because the Habits section pays streak-scaled
    // XP, so it needs the streak as well as today's state. 400 days is the
    // ceiling: a longer streak is under-reported rather than paged for.
    supabase
      .from('habit_logs')
      .select('habit_id, log_date')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('log_date', habitStreakWindowStart(today))
      .lte('log_date', today),
    supabase
      .from('tasks')
      .select('id, title, due_date, priority')
      .eq('user_id', user.id)
      .eq('is_completed', false)
      .or(`due_date.lte.${today},due_date.is.null`)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(DASHBOARD_TASK_FETCH_LIMIT),
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
      .select('blocks,notes')
      .eq('user_id', user.id)
      .eq('plan_date', today)
      .maybeSingle(),
    isAdmin ? fetchRoutines(supabase, user.id, false) : Promise.resolve([]),
    isAdmin ? fetchDashboardLearnings(supabase, user.id) : Promise.resolve([]),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', false),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .gte('completed_at', `${today}T00:00:00`)
      .lt('completed_at', `${addDays(today, 1)}T00:00:00`),
  ])

  const habitLogRows = (briefingHabitLogsRes.data ?? []) as HabitLogRow[]
  const completedHabitIds = completedHabitIdsFor(habitLogRows, today)
  const dashboardHabits = buildDashboardHabits(
    (briefingHabitsRes.data ?? []) as HabitRow[],
    habitLogRows,
    today
  )
  const briefingHabits = dashboardHabits.map(({ id, name, emoji, completed }) => ({
    id,
    name,
    emoji,
    completed,
  }))
  const { dueTasks, undatedTasks } = partitionDashboardTasks(
    (briefingTasksRes.data ?? []) as TaskRow[],
    today
  )
  const briefingTasks = [...dueTasks, ...undatedTasks]
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
  const isEvening = nowMinutes >= 20 * 60
  // journal_templates has no stable slug/key, only a DB id and a human name,
  // so this matches on name — if the system template is ever renamed or
  // removed, the prompt just stays hidden rather than erroring.
  const eveningReviewTemplate =
    briefingJournals.find((template) => template.name === 'Evening Review') ?? null
  const eveningReviewTemplateId = eveningReviewTemplate?.id ?? null
  const eveningReviewDone = eveningReviewTemplate?.completedToday ?? false
  const habitsCompletedToday = briefingHabits.filter((habit) => habit.completed).length
  const tasksCompletedToday = tasksCompletedTodayRes.count ?? 0
  const dayPlan = dayPlanRes.data as {
    blocks?: DayPlanBlock[]
    notes?: string | null
  } | null
  const planMetadata = parseTodayPlanNotes(dayPlan?.notes).metadata
  const planCommitted = Boolean(planMetadata?.ritual_completed_at)
  const mainQuestTitle =
    planMetadata?.outcomes.find((outcome) => outcome.role === 'must_win')?.title ?? null
  const planBlocks = ((dayPlan?.blocks ?? [])
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
        missionType: block.mission_type ?? null,
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
      <TrailPageSpine />
      <div className="relative max-w-2xl mx-auto space-y-5">
        <ThemedDashboardHero
          username={profile.username}
          level={level}
          cityTierLabel={CITY_TIER_LABELS[cityTier]}
          xpNext={progress.next}
          totalXp={profile.total_xp}
          pct={progress.pct}
          coins={coins}
          streak={profile.current_streak}
          equippedItems={avatarState.equippedItems}
        />

        <JournalNudge
          journals={briefingJournals}
          completedJournalCount={(todayEntriesRes.data ?? []).length}
        />

        <FirstRunWelcome show={showWelcome} />
        <DailyPlanPrompt today={today} planCommitted={planCommitted} username={profile.username} />
        <EveningReviewPrompt
          today={today}
          isEvening={isEvening}
          reviewDone={eveningReviewDone}
          templateId={eveningReviewTemplateId}
          username={profile.username}
          habitsCompleted={habitsCompletedToday}
          habitsTotal={briefingHabits.length}
          tasksCompletedToday={tasksCompletedToday}
        />

        <HabitsSection
          userId={user.id}
          today={today}
          habits={dashboardHabits}
        />

        <TasksSection
          userId={user.id}
          dueTasks={dueTasks}
          undatedTasks={undatedTasks}
          openTaskCount={openTasksRes.count ?? 0}
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
          mainQuestTitle={mainQuestTitle}
          planCommitted={planCommitted}
          goals={activeGoals}
          goalsEnabled={isAdmin}
          completedJournalCount={(todayEntriesRes.data ?? []).length}
          routinesEnabled={isAdmin}
          initialOpenPanel={
            quickAction === 'routine'
              ? (isAdmin ? 'routine' : null)
              : quickAction === 'goal'
                ? (isAdmin ? 'goal' : null)
              : quickAction === 'task' || quickAction === 'habit'
              ? quickAction
              : null
          }
        />

        {primaryMetric && (
          <MetricDashboardWidget
            label={primaryMetric.label}
            unit={primaryMetric.unit}
            data={primaryMetricSeries}
            hasMoreMetrics={trackedMetrics.length > 1}
          />
        )}

        {isAdmin && (
          <AdminLearningWidget
            learnings={dashboardLearnings}
            dailyKey={today}
          />
        )}

        {isAdmin && <RoutinesDashboardWidget routines={dashboardRoutines} />}

        <QuestDashboardWidget
          claimable={claimableQuests}
          activeCustom={activeCustomQuests}
        />
      </div>
    </div>
  )
}

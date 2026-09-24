import type { SupabaseClient } from '@supabase/supabase-js'
import type { DayPlanBlock } from '@/lib/types'

export interface CalendarPlan {
  plan_date: string
  blocks: DayPlanBlock[]
}

export interface CalendarTask {
  id: string
  title: string
  due_date: string
  is_completed: boolean
  project_id: string | null
}

const PAGE_SIZE = 500

/** Read existing plans and task deadlines. Never turns a failed read into an empty calendar. */
export async function loadCalendarData(
  supabase: SupabaseClient,
  userId: string,
  start: string,
  end: string,
): Promise<{ plans: CalendarPlan[]; tasks: CalendarTask[] }> {
  async function pageThrough<T>(table: 'day_plans' | 'tasks', columns: string, dateColumn: string): Promise<T[]> {
    const rows: T[] = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('user_id', userId)
        .gte(dateColumn, start)
        .lte(dateColumn, end)
        .order(dateColumn)
        .order('id')
        .range(offset, offset + PAGE_SIZE - 1)
      if (error) throw new Error(`Calendar ${table} could not be loaded: ${error.message}`)
      const page = (data ?? []) as T[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) return rows
    }
  }

  const [rawPlans, rawTasks] = await Promise.all([
    pageThrough<CalendarPlan>('day_plans', 'plan_date,blocks', 'plan_date'),
    pageThrough<CalendarTask>('tasks', 'id,title,due_date,is_completed,project_id', 'due_date'),
  ])

  return {
    plans: rawPlans.map((plan) => ({ ...plan, blocks: Array.isArray(plan.blocks) ? plan.blocks : [] })),
    tasks: rawTasks.filter((task) => typeof task.due_date === 'string'),
  }
}

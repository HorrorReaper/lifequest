import { format, subDays } from 'date-fns'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'
import { isAdminUser } from '@/lib/admin'

type ChatRole = 'user' | 'assistant'
type Priority = 'low' | 'medium' | 'high'
type AssistantActionType =
  | 'none'
  | 'create_task'
  | 'complete_task'
  | 'create_habit'
  | 'check_habit'
  | 'analyze_journals'

interface ChatMessage {
  role: ChatRole
  content: string
}

interface ChatRequestBody {
  messages?: unknown
}

interface OpenRouterResponseBody {
  choices?: {
    message?: {
      content?: string
    }
  }[]
}

interface AssistantDecision {
  reply: string
  action: {
    type: AssistantActionType
    title: string | null
    description: string | null
    priority: Priority | null
    due_date: string | null
    task_id: string | null
    name: string | null
    emoji: string | null
    color: string | null
    habit_id: string | null
    range: '7d' | '30d' | null
  }
}

interface TaskRow {
  id: string
  user_id: string
  title: string
  description: string | null
  is_completed: boolean
  due_date: string | null
  priority: Priority
  created_at: string
  completed_at: string | null
}

interface HabitRow {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  is_archived: boolean
  sort_order: number
  created_at: string
}

interface HabitLogRow {
  habit_id: string
}

interface JournalEntryRow {
  id: string
  entry_date: string
  template_id: string
  xp_earned: number
  created_at: string
  journal_templates?:
    | {
        name: string | null
        icon: string | null
      }
    | {
        name: string | null
        icon: string | null
      }[]
    | null
}

interface JournalResponseRow {
  entry_id: string
  field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_json: Json | null
}

interface TemplateFieldRow {
  id: string
  label: string
  field_type: string
}

interface ProfileXpRow {
  total_xp: number | null
}

interface AiConsentRow {
  ai_assistant_enabled: boolean
  ai_consent_at: string | null
}

interface AssistantContext {
  today: string
  tasks: {
    id: string
    title: string
    description: string | null
    priority: Priority
    due_date: string | null
    is_completed: boolean
  }[]
  habits: {
    id: string
    name: string
    emoji: string
    completed_today: boolean
  }[]
  journals: {
    id: string
    date: string
    template: string
    responses: { label: string; value: string }[]
  }[]
}

interface ActionResult {
  type: AssistantActionType
  status: 'completed' | 'none'
}

interface ChatResponseBody {
  reply: string
  action: ActionResult
}

const assistantResponseSchema = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description:
        'User-facing response. If analyzing journals, include the actual analysis here.',
    },
    action: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'none',
            'create_task',
            'complete_task',
            'create_habit',
            'check_habit',
            'analyze_journals',
          ],
        },
        title: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        priority: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null] },
        due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null.' },
        task_id: { type: ['string', 'null'] },
        name: { type: ['string', 'null'] },
        emoji: { type: ['string', 'null'] },
        color: { type: ['string', 'null'] },
        habit_id: { type: ['string', 'null'] },
        range: { type: ['string', 'null'], enum: ['7d', '30d', null] },
      },
      required: [
        'type',
        'title',
        'description',
        'priority',
        'due_date',
        'task_id',
        'name',
        'emoji',
        'color',
        'habit_id',
        'range',
      ],
      additionalProperties: false,
    },
  },
  required: ['reply', 'action'],
  additionalProperties: false,
}

function isChatRole(value: unknown): value is ChatRole {
  return value === 'user' || value === 'assistant'
}

function normalizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((message): message is { role: ChatRole; content: string } => {
      if (!message || typeof message !== 'object') return false
      const candidate = message as { role?: unknown; content?: unknown }
      return isChatRole(candidate.role) && typeof candidate.content === 'string'
    })
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-10)
}

function appClient(supabase: Awaited<ReturnType<typeof createClient>>): SupabaseClient {
  return supabase as unknown as SupabaseClient
}

function clampText(value: string | null, max: number): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
}

function normalizePriority(value: Priority | null): Priority {
  return value === 'low' || value === 'high' ? value : 'medium'
}

function normalizeDueDate(value: string | null): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

function stringifyJsonValue(value: Json | null): string | null {
  if (value === null) return null

  if (Array.isArray(value)) {
    const checklistItems = value
      .filter((item): item is { label: string; checked?: boolean } => {
        return (
          typeof item === 'object' &&
          item !== null &&
          'label' in item &&
          typeof (item as { label?: unknown }).label === 'string'
        )
      })
      .map((item) => `${item.checked ? '[x]' : '[ ]'} ${item.label}`)

    if (checklistItems.length > 0) return checklistItems.join(', ')
  }

  return JSON.stringify(value).slice(0, 240)
}

function responseValue(response: JournalResponseRow): string | null {
  if (response.value_text?.trim()) return response.value_text.trim()
  if (response.value_number !== null) return String(response.value_number)
  if (response.value_boolean !== null) return response.value_boolean ? 'yes' : 'no'
  return stringifyJsonValue(response.value_json)
}

function journalTemplateName(entry: JournalEntryRow): string {
  const template = Array.isArray(entry.journal_templates)
    ? entry.journal_templates[0]
    : entry.journal_templates

  return template?.name ?? 'Journal entry'
}

function parseDecision(text: string): AssistantDecision {
  const parsed = JSON.parse(text) as AssistantDecision
  return {
    reply: clampText(parsed.reply, 1800),
    action: {
      type: parsed.action.type,
      title: parsed.action.title,
      description: parsed.action.description,
      priority: parsed.action.priority,
      due_date: parsed.action.due_date,
      task_id: parsed.action.task_id,
      name: parsed.action.name,
      emoji: parsed.action.emoji,
      color: parsed.action.color,
      habit_id: parsed.action.habit_id,
      range: parsed.action.range,
    },
  }
}

async function fetchAssistantContext(
  db: SupabaseClient,
  userId: string
): Promise<AssistantContext> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const [
    tasksResult,
    habitsResult,
    habitLogsResult,
    journalsResult,
  ] = await Promise.all([
    db
      .from('tasks')
      .select('id,user_id,title,description,is_completed,due_date,priority,created_at,completed_at')
      .eq('user_id', userId)
      .order('is_completed', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(15),
    db
      .from('habits')
      .select('id,user_id,name,emoji,color,is_archived,sort_order,created_at')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(15),
    db
      .from('habit_logs')
      .select('habit_id')
      .eq('user_id', userId)
      .eq('log_date', today)
      .eq('completed', true),
    db
      .from('journal_entries')
      .select('id,entry_date,template_id,xp_earned,created_at,journal_templates(name,icon)')
      .eq('user_id', userId)
      .eq('is_complete', true)
      .gte('entry_date', thirtyDaysAgo)
      .order('entry_date', { ascending: false })
      .limit(10),
  ])

  if (tasksResult.error) throw tasksResult.error
  if (habitsResult.error) throw habitsResult.error
  if (habitLogsResult.error) throw habitLogsResult.error
  if (journalsResult.error) throw journalsResult.error

  const tasks = (tasksResult.data ?? []) as TaskRow[]
  const habits = (habitsResult.data ?? []) as HabitRow[]
  const completedHabitIds = new Set(
    ((habitLogsResult.data ?? []) as HabitLogRow[]).map((log) => log.habit_id)
  )
  const journals = (journalsResult.data ?? []) as unknown as JournalEntryRow[]
  const journalIds = journals.map((entry) => entry.id)

  let responses: JournalResponseRow[] = []
  let fields: TemplateFieldRow[] = []

  if (journalIds.length > 0) {
    const { data: responseData, error: responseError } = await db
      .from('journal_responses')
      .select('entry_id,field_id,value_text,value_number,value_boolean,value_json')
      .in('entry_id', journalIds)

    if (responseError) throw responseError
    responses = (responseData ?? []) as JournalResponseRow[]

    const fieldIds = [...new Set(responses.map((response) => response.field_id))]
    if (fieldIds.length > 0) {
      const { data: fieldData, error: fieldError } = await db
        .from('template_fields')
        .select('id,label,field_type')
        .in('id', fieldIds)

      if (fieldError) throw fieldError
      fields = (fieldData ?? []) as TemplateFieldRow[]
    }
  }

  const fieldById = new Map(fields.map((field) => [field.id, field]))

  return {
    today,
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      is_completed: task.is_completed,
    })),
    habits: habits.map((habit) => ({
      id: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      completed_today: completedHabitIds.has(habit.id),
    })),
    journals: journals.map((entry) => ({
      id: entry.id,
      date: entry.entry_date,
      template: journalTemplateName(entry),
      responses: responses
        .filter((response) => response.entry_id === entry.id)
        .map((response) => ({
          label: fieldById.get(response.field_id)?.label ?? 'Response',
          value: responseValue(response) ?? '',
        }))
        .filter((response) => response.value.length > 0)
        .slice(0, 8),
    })),
  }
}

async function executeAction(
  db: SupabaseClient,
  userId: string,
  context: AssistantContext,
  decision: AssistantDecision
): Promise<ChatResponseBody> {
  const action = decision.action

  if (action.type === 'none' || action.type === 'analyze_journals') {
    return {
      reply: decision.reply,
      action: { type: action.type, status: action.type === 'none' ? 'none' : 'completed' },
    }
  }

  if (action.type === 'create_task') {
    const title = clampText(action.title, 120)
    if (!title) throw new Error('I need a task title before I can add it.')

    const { data, error } = await db
      .from('tasks')
      .insert({
        user_id: userId,
        title,
        description: clampText(action.description, 260) || null,
        priority: normalizePriority(action.priority),
        due_date: normalizeDueDate(action.due_date),
      })
      .select('id,title')
      .single()

    if (error) throw error
    const task = data as Pick<TaskRow, 'id' | 'title'>

    return {
      reply: `Added task: ${task.title}.`,
      action: { type: 'create_task', status: 'completed' },
    }
  }

  if (action.type === 'complete_task') {
    const task = context.tasks.find((item) => item.id === action.task_id)
    if (!task) throw new Error('I could not find that task in your current task list.')
    if (task.is_completed) {
      return {
        reply: `That task is already complete: ${task.title}.`,
        action: { type: 'complete_task', status: 'completed' },
      }
    }

    const { error } = await db
      .from('tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)
      .eq('user_id', userId)

    if (error) throw error
    await awardTaskXp(db, userId, task.id, task.title)

    return {
      reply: `Marked task complete: ${task.title}. You earned +5 XP.`,
      action: { type: 'complete_task', status: 'completed' },
    }
  }

  if (action.type === 'create_habit') {
    const name = clampText(action.name, 80)
    if (!name) throw new Error('I need a habit name before I can add it.')

    const { data, error } = await db
      .from('habits')
      .insert({
        user_id: userId,
        name,
        emoji: clampText(action.emoji, 4) || '✅',
        color: clampText(action.color, 24) || 'blue',
      })
      .select('id,name')
      .single()

    if (error) throw error
    const habit = data as Pick<HabitRow, 'id' | 'name'>

    return {
      reply: `Added habit: ${habit.name}.`,
      action: { type: 'create_habit', status: 'completed' },
    }
  }

  if (action.type === 'check_habit') {
    const habit = context.habits.find((item) => item.id === action.habit_id)
    if (!habit) throw new Error('I could not find that habit in your active habits.')

    const { error } = await db
      .from('habit_logs')
      .upsert(
        {
          user_id: userId,
          habit_id: habit.id,
          log_date: context.today,
          completed: true,
          entry_id: null,
        },
        { onConflict: 'user_id,habit_id,log_date' }
      )

    if (error) throw error

    return {
      reply: `Checked off habit for today: ${habit.name}.`,
      action: { type: 'check_habit', status: 'completed' },
    }
  }

  return {
    reply: decision.reply,
    action: { type: 'none', status: 'none' },
  }
}

async function awardTaskXp(
  db: SupabaseClient,
  userId: string,
  taskId: string,
  title: string
) {
  const award = 5

  const { error: eventError } = await db.from('xp_events').insert({
    user_id: userId,
    source_type: 'task',
    source_id: taskId,
    xp_amount: award,
    description: `Completed task: ${title}`,
  })

  if (eventError) throw eventError

  const { data: profileData, error: profileError } = await db
    .from('profiles')
    .select('total_xp')
    .eq('id', userId)
    .single()

  if (profileError) throw profileError

  const profile = profileData as ProfileXpRow | null
  const nextTotalXp = (profile?.total_xp ?? 0) + award

  const { error: profileUpdateError } = await db
    .from('profiles')
    .update({ total_xp: nextTotalXp, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (profileUpdateError) throw profileUpdateError

  return nextTotalXp
}

async function getAssistantDecision(
  apiKey: string,
  messages: ChatMessage[],
  context: AssistantContext
): Promise<AssistantDecision> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-OpenRouter-Title': 'LifeQuest',
  }

  const siteUrl = process.env.OPENROUTER_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (siteUrl) headers['HTTP-Referer'] = siteUrl

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are the LifeQuest assistant inside a gamified journaling and personal growth app. You can answer normally or choose exactly one supported app action. Supported actions: create_task, complete_task, create_habit, check_habit, analyze_journals, none. Use only task_id and habit_id values that exist in the provided context. If matching is ambiguous, choose none and ask a short clarification. For journal analysis, use the provided journal context and include practical themes, blockers, and next actions in reply. Do not give medical, legal, financial, or crisis advice.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            instruction:
              'Given the conversation and LifeQuest context, return a JSON decision. Prefer executing simple low-risk user requests directly: add a task, add a habit, mark a clear task complete, check a clear habit for today, or analyze recent journals. Never invent IDs.',
            today: context.today,
            context,
            conversation: messages,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lifequest_chat_decision',
          strict: true,
          schema: assistantResponseSchema,
        },
      },
      temperature: 0.3,
      max_tokens: 900,
    }),
  })

  if (!response.ok) {
    const message = await response.text()
    console.error('OpenRouter chat failed:', message)
    throw new Error('The assistant is unavailable right now.')
  }

  const data = (await response.json()) as OpenRouterResponseBody
  const text = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('The assistant returned an empty response.')

  return parseDecision(text)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const db = appClient(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI chat is not configured yet. Add OPENROUTER_API_KEY to enable it.' },
      { status: 503 }
    )
  }

  const { data: consentData, error: consentError } = await db
    .from('profiles')
    .select('ai_assistant_enabled,ai_consent_at')
    .eq('id', user.id)
    .single()

  if (consentError) {
    return NextResponse.json(
      { error: 'The assistant privacy preference could not be verified.' },
      { status: 503 }
    )
  }

  const consent = consentData as AiConsentRow | null
  if (!consent?.ai_assistant_enabled || !consent.ai_consent_at) {
    return NextResponse.json(
      { error: 'Enable the contextual AI assistant in Settings before sending a message.' },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequestBody
  const messages = normalizeMessages(body.messages)
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')

  if (!lastUserMessage) {
    return NextResponse.json({ error: 'Send a message first.' }, { status: 400 })
  }

  try {
    const context = await fetchAssistantContext(db, user.id)
    const decision = await getAssistantDecision(apiKey, messages, context)
    const result = await executeAction(db, user.id, context, decision)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Chat route error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The assistant is unavailable right now.',
      },
      { status: 500 }
    )
  }
}


'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { supabaseInsert, supabaseFrom, supabaseUpdateWhere } from '@/lib/supabase/helpers'
import type { Database, Json } from '@/lib/supabase/database.types'
import { useUserStore } from '@/lib/stores/user-store'
import { FieldRenderer } from '@/components/journal/field-renderer'
import { upsertDayPlan } from '@/lib/day-plans'
import { Button } from '@/components/ui/button'
import { logHabits } from "@/lib/habits";
import { format } from "date-fns";
import {
  JournalTemplate,
  TemplateField,
  XpRule,
  FieldValue,
  ChecklistItem,
  DayPlanBlock,
} from '@/lib/types'
import { cleanLearningDraft, type LearningFieldValue } from '@/lib/learnings'
import { calculateEntryBonusXp } from '@/lib/gamification'
import { BookOpenCheck, CheckCircle2, Sparkles } from 'lucide-react'
import { DraftTask } from './TasksInput'

interface EntryFormProps {
  template: JournalTemplate
  fields: TemplateField[]
  existingEntryId?: string
  existingResponses?: Record<string, FieldValue>
}

const DISPLAY_ONLY_TYPES = ['divider', 'heading', 'prompt']

type JournalResponseInsert = Database['public']['Tables']['journal_responses']['Insert']

interface TodayEntryWithTemplate {
  id: string
  template_id: string
  journal_templates: { entry_type: string } | { entry_type: string }[] | null
}

interface ProfileSnapshot {
  total_xp: number
  current_streak: number
  best_streak: number
  last_journal_date: string | null
  streak_freezes: number
}

interface TaskInsertClient {
  from(table: 'tasks'): {
    insert(payload: Array<{
      user_id: string
      entry_id: string
      field_id: string
      title: string
      priority: 'low' | 'medium' | 'high'
      due_date: string | null
    }>): PromiseLike<{ error: unknown }>
  }
}

function learningValueFromField(value: FieldValue | undefined): LearningFieldValue | null {
  if (!value?.value_json || typeof value.value_json !== 'object' || Array.isArray(value.value_json)) {
    return null
  }

  const candidate = value.value_json as Partial<LearningFieldValue>

  return {
    title: typeof candidate.title === 'string' ? candidate.title : '',
    note: typeof candidate.note === 'string' ? candidate.note : '',
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    action_text: typeof candidate.action_text === 'string' ? candidate.action_text : null,
  }
}

function isFieldComplete(field: TemplateField, value: FieldValue | undefined) {
  if (DISPLAY_ONLY_TYPES.includes(field.field_type)) return true
  if (!value) return false

  switch (field.field_type) {
    case 'text':
    case 'textarea':
    case 'select':
    case 'mood':
      return Boolean(value.value_text?.trim())
    case 'number':
    case 'slider':
    case 'rating':
      return value.value_number !== null && value.value_number !== undefined
    case 'checkbox':
      return Boolean(value.value_boolean)
    case 'checklist':
      return Boolean(
        value.value_json &&
          (value.value_json as ChecklistItem[]).some((item) => item.checked)
      )
    case 'tasks':
      return ((value.value_json as DraftTask[] | null) ?? []).some((task) => task.title.trim())
    case 'day_planner':
      return Boolean(
        value.value_json &&
          ((value.value_json as { blocks?: DayPlanBlock[] }).blocks?.length ?? 0) > 0
      )
    case 'habit_tracker':
      return ((value.value_json as string[] | null) ?? []).length > 0
    case 'learning': {
      const learning = learningValueFromField(value)
      return Boolean(learning?.title.trim() && learning.note.trim())
    }
    default:
      return false
  }
}

export function EntryForm({
  template,
  fields,
  existingEntryId,
  existingResponses,
}: EntryFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const { addXp, updateStreak } = useUserStore()

  // Initialize field values
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    if (existingResponses) return existingResponses

    const initial: Record<string, FieldValue> = {}
    for (const field of fields) {
      if (DISPLAY_ONLY_TYPES.includes(field.field_type)) continue

      const config = field.config as Record<string, unknown>
      initial[field.id] = {
        field_id: field.id,
        value_text: null,
        value_number:
          field.field_type === 'slider'
            ? (config?.min as number) ?? 1
            : null,
        value_boolean: field.field_type === 'checkbox' ? false : null,
        value_json:
          field.field_type === 'checklist'
            ? ((config?.items as string[]) ?? []).map(
                (label: string) => ({ label, checked: false } as ChecklistItem)
              )
            : field.field_type === 'learning'
              ? {
                  title: '',
                  note: '',
                  tags: (config?.defaultTags as string[]) ?? [],
                  action_text: null,
                }
            : null,
      }
    }
    return initial
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [xpEarned, setXpEarned] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function updateValue(fieldId: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const previewBonusXp = useMemo(() => {
    try {
      return calculateEntryBonusXp(
        fields.map((f) => ({
          id: f.id,
          field_type: f.field_type,
          xp_rules: (f.xp_rules as XpRule[]) ?? [],
        })),
        values
      )
    } catch (e) {
      console.error('Failed to calculate preview bonus XP', e)
      return 0
    }
  }, [fields, values])

  const requiredFields = useMemo(
    () => fields.filter((field) => field.is_required && !DISPLAY_ONLY_TYPES.includes(field.field_type)),
    [fields]
  )
  const completedRequiredFields = requiredFields.filter((field) => isFieldComplete(field, values[field.id])).length
  const progressPercent =
    requiredFields.length > 0
      ? Math.round((completedRequiredFields / requiredFields.length) * 100)
      : 100

  function validate(): boolean {
    for (const field of fields) {
      if (!field.is_required) continue
      if (DISPLAY_ONLY_TYPES.includes(field.field_type)) continue
      if (!isFieldComplete(field, values[field.id])) return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      const bonusXp = calculateEntryBonusXp(
        fields.map((f) => ({
          id: f.id,
          field_type: f.field_type,
          xp_rules: (f.xp_rules as XpRule[]) ?? [],
        })),
        values
      )
      const entryXp = template.xp_reward + bonusXp

      // 1. Create or update journal entry
      let entryId = existingEntryId

      if (entryId) {
        await supabaseUpdateWhere(supabase, 'journal_entries', {
          is_complete: true,
          xp_earned: entryXp,
          updated_at: new Date().toISOString(),
        }, 'id', entryId)
      } else {
        const { data: entry, error: entryError } = await supabaseFrom(supabase, 'journal_entries')
          .insert({
            user_id: user.id,
            template_id: template.id,
            entry_date: new Date().toISOString().split('T')[0],
            is_complete: true,
            xp_earned: entryXp,
          })
          .select('id')
          .single()

        if (entryError) throw entryError
        entryId = (entry as { id: string }).id
      }

      // 2. Upsert responses
      const responses: JournalResponseInsert[] = Object.entries(values).map(([fieldId, val]) => ({
        entry_id: entryId!,
        field_id: fieldId,
        value_text: val.value_text ?? null,
        value_number: val.value_number ?? null,
        value_boolean: val.value_boolean ?? null,
        value_json: (val.value_json ?? null) as Json | null,
      }))

      // Delete existing responses if editing
      if (existingEntryId) {
        await supabase
          .from('journal_responses')
          .delete()
          .eq('entry_id', entryId!)
      }

      const { error: responseError } = await supabaseInsert(supabase, 'journal_responses', responses)

      if (responseError) throw responseError

      // Sync Learning fields into the Learning Library.
      for (const field of fields) {
        if (field.field_type !== 'learning') continue

        const { error: deleteLearningError } = await supabaseFrom(supabase, 'journal_learnings')
          .delete()
          .eq('user_id', user.id)
          .eq('entry_id', entryId!)
          .eq('field_id', field.id)

        if (deleteLearningError) throw deleteLearningError

        const learningValue = learningValueFromField(values[field.id])
        if (!learningValue) continue

        const cleaned = cleanLearningDraft(learningValue)
        if (!cleaned.title || !cleaned.note) continue

        const { error: learningError } = await supabaseFrom(supabase, 'journal_learnings')
          .insert({
            user_id: user.id,
            entry_id: entryId!,
            field_id: field.id,
            title: cleaned.title,
            note: cleaned.note,
            tags: cleaned.tags,
            source_response_ids: [],
            action_text: cleaned.action_text,
          })

        if (learningError) throw learningError
      }

      // 2) Find tasks fields and persist their tasks
      const taskInserts: Array<{
        user_id: string
        entry_id: string
        field_id: string
        title: string
        priority: 'low' | 'medium' | 'high'
        due_date: string | null
      }> = []

      for (const field of fields) {
        if (field.field_type !== 'tasks' && field.field_type !== 'habit_tracker') continue

        if (field.field_type === 'habit_tracker') {
          const completedIds = (values[field.id]?.value_json ?? []) as string[]
          if (completedIds.length === 0) continue

          await logHabits(
            supabase,
            user.id,
            entryId!,
            format(new Date(), 'yyyy-MM-dd'),
            completedIds
          )

          continue
        }

        if (field.field_type === 'tasks') {
          const drafts = (values[field.id]?.value_json ?? []) as DraftTask[]
          for (const t of drafts) {
            if (!t.title?.trim()) continue
            taskInserts.push({
              user_id: user.id,
              entry_id: entryId!,
              field_id: field.id,
              title: t.title,
              priority: t.priority,
              due_date: t.due_date,
            })
          }
        }
      }

      if (taskInserts.length > 0) {
        const taskClient = supabase as unknown as TaskInsertClient
        const { error: tasksError } = await taskClient.from('tasks').insert(taskInserts)
        if (tasksError) console.error('Failed to insert tasks:', tasksError)
      }

      // Persist any Day Planner fields
      for (const field of fields) {
        if (field.field_type !== 'day_planner') continue
        const planValue =
          (values[field.id]?.value_json as { plan_date: string; blocks: DayPlanBlock[] } | null) ??
          null
        if (!planValue || !planValue.plan_date || (planValue.blocks?.length ?? 0) === 0) continue

        await upsertDayPlan(supabase, user.id, {
          plan_date: planValue.plan_date,
          blocks: planValue.blocks,
          entry_id: entryId!,
          field_id: field.id,
        })
      }

      // 3. Record XP event
      let totalXpEarned = entryXp

      // Check for morning+evening same-day bonus
      const today = new Date().toISOString().split('T')[0]
      const { data: todayEntriesData } = await supabase
        .from('journal_entries')
        .select('id, template_id, journal_templates!inner(entry_type)')
        .eq('user_id', user.id)
        .eq('entry_date', today)
        .eq('is_complete', true)

      const todayEntries = (todayEntriesData as unknown as TodayEntryWithTemplate[] | null) ?? []

      if (todayEntries.length > 0) {
        const entryTypes = todayEntries
          .map((entry) => {
            const templateForEntry = Array.isArray(entry.journal_templates)
              ? entry.journal_templates[0]
              : entry.journal_templates

            return templateForEntry?.entry_type
          })
          .filter((entryType): entryType is string => Boolean(entryType))
        const hasMorning = entryTypes.includes('morning')
        const hasEvening = entryTypes.includes('evening')

        if (hasMorning && hasEvening && (template.entry_type === 'morning' || template.entry_type === 'evening')) {
          totalXpEarned += 5
        }
      }

      await supabaseInsert(supabase, 'xp_events', {
        user_id: user.id,
        source_type: 'journal',
        source_id: entryId!,
        xp_amount: totalXpEarned,
        description: `Completed ${template.name}`,
      })

      // 4. Update profile XP
      const { data: profileData } = await supabase
        .from('profiles')
        .select('total_xp, current_streak, best_streak, last_journal_date, streak_freezes')
        .eq('id', user.id)
        .single()

      const profile = profileData as ProfileSnapshot | null

      if (profile) {
        const newTotalXp = profile.total_xp + totalXpEarned
        let newStreak = profile.current_streak

        const lastDate = profile.last_journal_date
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        if (lastDate === today) {
          // Already journaled today — no streak change
        } else if (lastDate === yesterdayStr) {
          // Consecutive day
          newStreak += 1
        } else if (!lastDate) {
          // First ever entry
          newStreak = 1
        } else {
          // Missed day(s) — check freeze
          const daysBetween = Math.floor((new Date(today).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
          if (daysBetween === 2 && profile.streak_freezes > 0) {
            // Use a freeze
            newStreak += 1
            await supabaseUpdateWhere(supabase, 'profiles', { streak_freezes: profile.streak_freezes - 1 }, 'id', user.id)
          } else {
            // Streak reset
            if (profile.current_streak > 0) {
              await supabaseInsert(supabase, 'streak_history', {
                user_id: user.id,
                streak_length: profile.current_streak,
                started_on: new Date(new Date(lastDate).getTime() - (profile.current_streak - 1) * 86400000).toISOString().split('T')[0],
                ended_on: lastDate,
                used_freeze: false,
              })
            }
            newStreak = 1
          }
        }

        // Check streak milestone bonuses
        let streakBonus = 0
        const milestones = [
          { days: 7, bonus: 50 },
          { days: 14, bonus: 100 },
          { days: 30, bonus: 200 },
          { days: 100, bonus: 500 },
        ]
        for (const m of milestones) {
          if (newStreak === m.days) {
            streakBonus = m.bonus
            await supabaseInsert(supabase, 'xp_events', {
              user_id: user.id,
              source_type: 'streak_bonus',
              source_id: entryId!,
              xp_amount: m.bonus,
              description: `${m.days}-day streak bonus!`,
            })
          }
        }

        const finalXp = newTotalXp + streakBonus

        await supabaseUpdateWhere(supabase, 'profiles', {
          total_xp: finalXp,
          current_streak: newStreak,
          best_streak: Math.max(profile.best_streak, newStreak),
          last_journal_date: today,
          updated_at: new Date().toISOString(),
        }, 'id', user.id)

        // Update Zustand store
        addXp(totalXpEarned + streakBonus, profile.total_xp)
        updateStreak(newStreak)
        setXpEarned(totalXpEarned + streakBonus)
      }

      setSubmitted(true)
    } catch (err) {
      console.error('Submit error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Success screen
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto flex max-w-xl flex-col items-center gap-6 rounded-[2rem] border bg-card p-8 text-center shadow-sm sm:p-10"
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', delay: 0.15 }}
          className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <CheckCircle2 className="size-8" />
        </motion.div>
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Reflection saved</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your journal entry is stored. Take the next useful action when you&apos;re ready.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-full border bg-background px-4 py-2"
        >
          <span className="text-sm font-semibold text-primary">
            +{xpEarned} XP
          </span>
        </motion.div>
        <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row">
          <Button variant="outline" onClick={() => router.push('/journal')}>
            Back to Journal
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="overflow-hidden rounded-[2rem] border bg-card shadow-sm">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/8 to-transparent" />
          <div className="relative space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl">
                {template.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Reflection ritual
                </p>
                <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
                  {template.name}
                </h1>
                {template.description && (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {template.description}
                  </p>
                )}
              </div>
              <span className="w-fit rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                +{template.xp_reward} XP
              </span>
            </div>

            <div className="rounded-2xl border bg-background/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-muted-foreground">
                  {requiredFields.length > 0
                    ? `${completedRequiredFields}/${requiredFields.length} required fields`
                    : 'Optional reflection'}
                </span>
                <span className="font-semibold text-primary">{progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <FieldRenderer
              field={field}
              value={
                values[field.id] ?? {
                  field_id: field.id,
                  value_text: null,
                  value_number: null,
                  value_boolean: null,
                  value_json: null,
                }
              }
              onChange={(val) => updateValue(field.id, val)}
              disabled={!!existingEntryId && false}
            />
          </motion.div>
        ))}
      </div>

      {error && (
        <p className="rounded-2xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {previewBonusXp > 0 && (
        <div className="flex items-center gap-2 rounded-2xl border bg-primary/5 p-3 text-sm">
          <Sparkles className="size-4 text-primary" />
          <span className="font-medium text-primary">
            +{previewBonusXp} bonus XP is ready when you save this reflection.
          </span>
        </div>
      )}

      <div className="sticky bottom-[calc(var(--bottom-nav-height)+var(--safe-area-bottom)+0.75rem)] z-10 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:bottom-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="h-10 flex-1"
          >
            Cancel
          </Button>
          <Button type="submit" className="h-10 flex-1" disabled={submitting}>
            <BookOpenCheck className="mr-1.5 size-4" />
            {submitting ? 'Saving...' : 'Save Reflection'}
          </Button>
        </div>
      </div>
    </form>
  )
}

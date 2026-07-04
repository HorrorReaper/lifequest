
'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { supabaseInsert, supabaseFrom, supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { useUserStore } from '@/lib/stores/user-store'
import { FieldRenderer } from '@/components/journal/field-renderer'
import { upsertDayPlan } from '@/lib/day-plans'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { logHabits } from "@/lib/habits";
import { format } from "date-fns";
import {
  JournalTemplate,
  TemplateField,
  XpRule,
  FieldValue,
  ChecklistItem,
} from '@/lib/types'
import { calculateEntryBonusXp } from '@/lib/gamification'
import { Sparkles } from 'lucide-react'
import { DraftTask } from './TasksInput'

interface EntryFormProps {
  template: JournalTemplate
  fields: TemplateField[]
  existingEntryId?: string
  existingResponses?: Record<string, FieldValue>
}

const DISPLAY_ONLY_TYPES = ['divider', 'heading', 'prompt']

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

  function validate(): boolean {
    for (const field of fields) {
      if (!field.is_required) continue
      if (DISPLAY_ONLY_TYPES.includes(field.field_type)) continue

      const val = values[field.id]
      if (!val) return false

      switch (field.field_type) {
        case 'text':
        case 'textarea':
        case 'select':
        case 'mood':
          if (!val.value_text?.trim()) return false
          break
        case 'number':
        case 'slider':
        case 'rating':
          if (val.value_number === null || val.value_number === undefined)
            return false
          break
        case 'checkbox':
          // Checkbox required means it must be checked
          if (!val.value_boolean) return false
          break
        case 'checklist':
          // At least one item checked
          if (
            !val.value_json ||
            !(val.value_json as ChecklistItem[]).some((i) => i.checked)
          )
            return false
          break
      }
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
        entryId = (entry as any).id
      }

      // 2. Upsert responses
      const responses = Object.entries(values).map(([fieldId, val]) => ({
        entry_id: entryId!,
        field_id: fieldId,
        value_text: val.value_text ?? null,
        value_number: val.value_number ?? null,
        value_boolean: val.value_boolean ?? null,
        value_json: val.value_json ?? null,
      }))

      // Delete existing responses if editing
      if (existingEntryId) {
        await supabase
          .from('journal_responses')
          .delete()
          .eq('entry_id', entryId!)
      }

      const { error: responseError } = await supabaseInsert(supabase, 'journal_responses', responses as any)

      if (responseError) throw responseError

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
        const { error: tasksError } = await supabaseInsert(supabase, 'tasks' as any, taskInserts)
        if (tasksError) console.error('Failed to insert tasks:', tasksError)
      }

      // Persist any Day Planner fields
      for (const field of fields) {
        if (field.field_type !== 'day_planner') continue
        const planValue = (values[field.id]?.value_json as { plan_date: string; blocks: any[] } | null) ?? null
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

      const todayEntries = (todayEntriesData as any[]) ?? []

      if (todayEntries.length > 0) {
        const entryTypes = todayEntries.map((e) => (e.journal_templates as unknown as { entry_type: string }).entry_type)
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

      const profile = profileData as any

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
        className="flex flex-col items-center gap-6 py-12 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="text-6xl"
        >
          🎉
        </motion.div>
        <h2 className="text-2xl font-bold">Entry Complete!</h2>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl bg-primary/10 px-6 py-3"
        >
          <span className="text-lg font-bold text-primary">
            +{xpEarned} XP
          </span>
        </motion.div>
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => router.push('/journal')}>
            View Journal
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="border-border/50">
        <CardContent className="space-y-6 pt-6">
          {/* Template header */}
          <div className="flex items-center gap-3 pb-2">
            <span className="text-3xl">{template.icon}</span>
            <div>
              <h1 className="text-xl font-bold">{template.name}</h1>
              {template.description && (
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
              )}
            </div>
            <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              +{template.xp_reward} XP
            </span>
          </div>

          {/* Fields */}
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      {previewBonusXp > 0 && (
        <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/30 p-3 text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-purple-700 dark:text-purple-300 font-medium">
            You'll earn +{previewBonusXp} bonus XP based on your answers!
          </span>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? 'Saving...' : `Submit Entry (+${template.xp_reward} XP)`}
        </Button>
      </div>
    </form>
  )
}

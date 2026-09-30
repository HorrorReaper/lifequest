'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Eye, EyeOff, Flame, Plus, Save, Sparkles, Trash2, Users } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ChallengeDayRow, ChallengeTemplateRow } from '@/lib/supabase/database.types'
import {
  blankChallengeDraft,
  blankDay,
  draftDaysPayload,
  draftFromTemplate,
  unfuckYourLifeDraft,
  validateChallengeDraft,
  type ChallengeDraft,
  type DayDraft,
} from '@/lib/challenge-draft'
import { isAutomaticRule, slugifyChallengeTitle } from '@/lib/challenge-rules'
import { TOOL_REGISTRY } from '@/lib/tools/registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'
import { ChallengeDayEditor, type RuleParamOption } from './challenge-lab/ChallengeDayEditor'
import { cn } from '@/lib/utils'

type TemplateWithDays = ChallengeTemplateRow & { days: ChallengeDayRow[]; participants: number; active: number }

const TOOL_OPTIONS: RuleParamOption[] = TOOL_REGISTRY.map((tool) => ({ value: tool.id, label: tool.title }))

export function ChallengeLab() {
  const [supabase] = useState(() => createClient() as unknown as SupabaseClient)
  const [templates, setTemplates] = useState<TemplateWithDays[]>([])
  const [journalTemplates, setJournalTemplates] = useState<RuleParamOption[]>([])
  const [draft, setDraft] = useState<ChallengeDraft>(blankChallengeDraft)
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  const selected = useMemo(() => templates.find((item) => item.id === draft.id) ?? null, [templates, draft.id])
  const lockedLength = Boolean(selected && selected.participants > 0)

  const load = useCallback(
    async (selectId?: string) => {
      setLoading(true)
      const [templateRes, dayRes, enrollmentRes, journalRes] = await Promise.all([
        supabase.from('challenge_templates').select('*').order('updated_at', { ascending: false }),
        supabase.from('challenge_days').select('*').order('day_number'),
        supabase.from('challenge_enrollments').select('template_id, status'),
        supabase.from('journal_templates').select('id, name').eq('is_system', true).order('sort_order'),
      ])
      const enrollments = (enrollmentRes.data ?? []) as { template_id: string; status: string }[]
      const next = ((templateRes.data ?? []) as ChallengeTemplateRow[]).map((template) => ({
        ...template,
        days: ((dayRes.data ?? []) as ChallengeDayRow[]).filter((day) => day.template_id === template.id),
        participants: enrollments.filter((item) => item.template_id === template.id).length,
        active: enrollments.filter((item) => item.template_id === template.id && item.status === 'active').length,
      }))
      setTemplates(next)
      setJournalTemplates(((journalRes.data ?? []) as { id: string; name: string }[]).map((row) => ({ value: row.id, label: row.name })))
      const selectedTemplate = next.find((item) => item.id === selectId)
      if (selectedTemplate) setDraft(draftFromTemplate(selectedTemplate, selectedTemplate.days))
      setError(templateRes.error?.message ?? dayRes.error?.message ?? null)
      setLoading(false)
    },
    [supabase]
  )

  useEffect(() => {
    queueMicrotask(() => {
      setOrigin(window.location.origin)
      void load()
    })
  }, [load])

  function editTemplate(template: TemplateWithDays) {
    setDraft(draftFromTemplate(template, template.days))
    setNotice(null)
    setError(null)
  }

  function startNew(next: ChallengeDraft) {
    setDraft(next)
    setNotice(null)
    setError(null)
  }

  function updateDay(index: number, patch: Partial<DayDraft>) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)),
    }))
  }

  function moveDay(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const next = index + direction
      if (next < 0 || next >= current.days.length) return current
      const days = [...current.days]
      ;[days[index], days[next]] = [days[next], days[index]]
      return { ...current, days }
    })
  }

  function applyBulk() {
    const days = bulk
      .split('\n')
      .map((line) => line.replace(/^\s*(?:(?:day|tag)\s*)?\d+[.)\-:]?\s*/i, '').trim())
      .filter(Boolean)
      .map((line) => blankDay({ title: line.slice(0, 120), instructions: line, reflection_prompt: 'What did you notice, and what will you try next time?' }))
    if (!days.length) return
    setDraft((current) => ({ ...current, days }))
    setBulk('')
    setShowBulk(false)
  }

  async function save(publish: boolean) {
    const problem = validateChallengeDraft(draft, { publishing: publish })
    if (problem) {
      setError(problem)
      setNotice(null)
      return
    }
    if (
      selected &&
      selected.active > 0 &&
      !window.confirm(`${selected.active} people are doing this challenge right now. Your changes apply to them immediately. Save?`)
    ) {
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    const { data, error: saveError } = await supabase.rpc('admin_save_challenge_template', {
      p_template_id: draft.id,
      p_title: draft.title.trim(),
      p_description: draft.description.trim(),
      p_schedule_mode: draft.schedule_mode,
      p_xp_reward: draft.xp_reward,
      p_coin_reward: draft.coin_reward,
      p_is_published: publish,
      p_days: draftDaysPayload(draft.days),
      p_slug: draft.slug.trim() || null,
      p_tagline: draft.tagline.trim() || null,
    })
    if (saveError) {
      setError(
        saveError.message.includes('challenge_templates_slug_idx')
          ? 'Another challenge already uses this public link.'
          : saveError.message
      )
    } else {
      setNotice(publish ? (draft.is_published ? 'Changes are live.' : 'Challenge published.') : draft.is_published ? 'Challenge unpublished.' : 'Draft saved.')
      await load(data as string)
    }
    setSaving(false)
  }

  async function removeTemplate(template: TemplateWithDays) {
    if (template.participants > 0) {
      setError('People have joined this challenge, so it cannot be deleted. Unpublish it instead.')
      return
    }
    if (!window.confirm(`Delete “${template.title}”? This cannot be undone.`)) return
    const { error: deleteError } = await supabase.from('challenge_templates').delete().eq('id', template.id)
    if (deleteError) setError(deleteError.message)
    else {
      startNew(blankChallengeDraft())
      await load()
    }
  }

  const publicUrl = draft.slug.trim() ? `${origin}/challenge/${draft.slug.trim()}` : null
  const autoDays = draft.days.filter((day) => isAutomaticRule(day.completion_type)).length

  return (
    <div className="mx-auto max-w-[92rem] space-y-7">
      <AdminPageHeader
        eyebrow="Challenges · for every user"
        title="Challenge lab"
        description="Build day-by-day challenges, pick how each day completes (manually or detected automatically), and publish them to every user. A public link turns a challenge into a landing page."
      />
      {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p className="rounded-xl bg-primary/10 p-3 text-sm text-primary">{notice}</p>}

      <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="self-start rounded-[2rem] bg-card p-4 ring-1 ring-border xl:sticky xl:top-10">
          <div className="flex items-center justify-between px-2 py-2">
            <div>
              <p className="text-sm text-muted-foreground">Challenges</p>
              <p className="font-semibold">{templates.length} total</p>
            </div>
            <Button size="icon" onClick={() => startNew(blankChallengeDraft())} aria-label="New challenge">
              <Plus />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading challenges...</p>
            ) : templates.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No challenges yet.</p>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => editTemplate(template)}
                  className={cn(
                    'w-full rounded-2xl p-3 text-left ring-1 transition-colors',
                    draft.id === template.id ? 'bg-primary/10 ring-primary/30' : 'bg-muted/30 ring-border hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{template.title}</p>
                    {template.is_published ? (
                      <Eye className="size-4 shrink-0 text-primary" aria-label="Published" />
                    ) : (
                      <EyeOff className="size-4 shrink-0 text-muted-foreground" aria-label="Draft" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.duration_days} days · {template.schedule_mode} · {template.active} active / {template.participants} joined
                  </p>
                </button>
              ))
            )}
          </div>
          <Button variant="outline" className="mt-4 w-full" onClick={() => startNew(unfuckYourLifeDraft())}>
            <Flame />
            New “Unfuck Your Life” (14 days)
          </Button>
        </aside>

        <section className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {draft.id ? (draft.is_published ? 'Live challenge' : 'Draft') : 'New challenge'}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{draft.title || 'Untitled challenge'}</h2>
              {selected && selected.participants > 0 && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {selected.active} active, {selected.participants} joined in total. Texts and rules can change; the number of days cannot.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected && (
                <Button variant="ghost" size="icon" onClick={() => void removeTemplate(selected)} aria-label="Delete challenge">
                  <Trash2 />
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => startNew({ ...draft, id: null, title: `${draft.title} copy`, slug: '', is_published: false })}
                disabled={!draft.title}
              >
                <Copy />
                Duplicate
              </Button>
              <Button variant="outline" onClick={() => void save(draft.is_published)} disabled={saving}>
                <Save />
                {draft.is_published ? 'Save live changes' : 'Save draft'}
              </Button>
              <Button onClick={() => void save(!draft.is_published)} disabled={saving}>
                {draft.is_published ? (
                  <>
                    <EyeOff />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Eye />
                    Publish
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program-title">Title</Label>
              <Input
                id="program-title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Unfuck Your Life"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-mode">Schedule</Label>
              <select
                id="program-mode"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={draft.schedule_mode}
                onChange={(event) => setDraft({ ...draft, schedule_mode: event.target.value as ChallengeDraft['schedule_mode'] })}
              >
                <option value="sequential">At your pace · one day unlocks per calendar day</option>
                <option value="strict">Strict · a missed calendar day means restarting</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-tagline">Tagline</Label>
              <Input
                id="program-tagline"
                value={draft.tagline}
                onChange={(event) => setDraft({ ...draft, tagline: event.target.value })}
                placeholder="One sentence that makes someone want to start"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-description">Description</Label>
              <Textarea
                id="program-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="What changes for someone who finishes this?"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-slug">Public landing page</Label>
              <div className="flex gap-2">
                <Input
                  id="program-slug"
                  value={draft.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase() })}
                  placeholder="unfuck-your-life (leave empty for no public page)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft({ ...draft, slug: slugifyChallengeTitle(draft.title) })}
                  disabled={!draft.title.trim()}
                >
                  From title
                </Button>
              </div>
              {publicUrl && (
                <p className="text-xs text-muted-foreground">
                  {draft.is_published && selected?.slug === draft.slug.trim() ? (
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                      {publicUrl}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <>Will be live at {publicUrl} once published.</>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-xp">XP for finishing</Label>
              <Input
                id="program-xp"
                type="number"
                min={0}
                value={draft.xp_reward}
                onChange={(event) => setDraft({ ...draft, xp_reward: Number(event.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-coins">Coins for finishing</Label>
              <Input
                id="program-coins"
                type="number"
                min={0}
                value={draft.coin_reward}
                onChange={(event) => setDraft({ ...draft, coin_reward: Number(event.target.value) })}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Daily journey</p>
              <h3 className="text-xl font-semibold">
                {draft.days.length} days
                {autoDays > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle text-sm font-normal text-muted-foreground">
                    <Sparkles className="size-3.5 text-primary" />
                    {autoDays} auto-detected
                  </span>
                )}
              </h3>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulk(!showBulk)} disabled={lockedLength}>
                Bulk paste
              </Button>
              <Button
                variant="outline"
                onClick={() => setDraft({ ...draft, days: [...draft.days, blankDay()] })}
                disabled={lockedLength}
              >
                <Plus />
                Add day
              </Button>
            </div>
          </div>
          {showBulk && !lockedLength && (
            <div className="mt-4 rounded-2xl bg-muted/40 p-4">
              <Label htmlFor="bulk-days">One day per line (replaces all days)</Label>
              <Textarea
                id="bulk-days"
                className="mt-2 min-h-40"
                value={bulk}
                onChange={(event) => setBulk(event.target.value)}
                placeholder={'Day 1: Clear your desk\nDay 2: Write down three habits you want'}
              />
              <Button className="mt-3" onClick={applyBulk}>
                Replace daily journey
              </Button>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {draft.days.map((day, index) => (
              <ChallengeDayEditor
                key={index}
                day={day}
                index={index}
                total={draft.days.length}
                lengthLocked={lockedLength}
                journalTemplates={journalTemplates}
                tools={TOOL_OPTIONS}
                onChange={(patch) => updateDay(index, patch)}
                onMove={(direction) => moveDay(index, direction)}
                onRemove={() =>
                  setDraft((current) => ({ ...current, days: current.days.filter((_, dayIndex) => dayIndex !== index) }))
                }
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

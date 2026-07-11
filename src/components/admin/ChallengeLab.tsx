'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ChallengeDayRow, ChallengeTemplateRow } from '@/lib/supabase/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'
import { cn } from '@/lib/utils'

type DayDraft = { title: string; instructions: string; reflection_prompt: string }
type TemplateWithDays = ChallengeTemplateRow & { days: ChallengeDayRow[] }
type Draft = {
  id: string | null
  title: string
  description: string
  schedule_mode: 'sequential' | 'strict'
  xp_reward: number
  coin_reward: number
  is_published: boolean
  days: DayDraft[]
}

const SOCIAL_SKILLS_DAYS = [
  'Smile and make eye contact with three people',
  'Ask someone an open-ended question',
  'Give one sincere compliment',
  'Start a two-minute conversation with someone new',
  'Practice remembering and using someone’s name',
  'Ask a follow-up question instead of changing the subject',
  'Share one small personal story',
  'Introduce yourself to someone you see regularly',
  'Listen without planning your next response',
  'Invite someone to have coffee or take a short walk',
  'Ask someone what they are currently excited about',
  'Practice a confident introduction in front of a mirror',
  'Send a thoughtful message to an old contact',
  'Join a group conversation and contribute once',
  'Ask for a small recommendation',
  'Hold eye contact for one extra second',
  'Tell a short story with a clear beginning and ending',
  'Ask someone about a challenge they recently solved',
  'Express a different opinion respectfully',
  'Introduce two people who could benefit from knowing each other',
  'Practice leaving a conversation gracefully',
  'Ask for feedback on how you communicate',
  'Speak to someone you would normally avoid approaching',
  'Replace one closed question with an open question',
  'Make one specific observation that starts a conversation',
  'Share appreciation with someone who has helped you',
  'Practice speaking 10% slower in one conversation',
  'Suggest a concrete plan instead of saying “we should meet”',
  'Have a ten-minute conversation with your phone out of sight',
  'Organize a small social activity or make the invitation',
]

function blankDraft(): Draft {
  return { id: null, title: '', description: '', schedule_mode: 'sequential', xp_reward: 500, coin_reward: 250, is_published: false, days: [{ title: '', instructions: '', reflection_prompt: '' }] }
}

export function ChallengeLab() {
  const [supabase] = useState(() => createClient() as unknown as SupabaseClient)
  const [templates, setTemplates] = useState<TemplateWithDays[]>([])
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [bulk, setBulk] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (selectId?: string) => {
    setLoading(true)
    const [templateRes, dayRes] = await Promise.all([
      supabase.from('challenge_templates').select('*').order('updated_at', { ascending: false }),
      supabase.from('challenge_days').select('*').order('day_number'),
    ])
    const next = ((templateRes.data ?? []) as ChallengeTemplateRow[]).map((template) => ({
      ...template,
      days: ((dayRes.data ?? []) as ChallengeDayRow[]).filter((day) => day.template_id === template.id),
    }))
    setTemplates(next)
    const selected = next.find((item) => item.id === selectId)
    if (selected) editTemplate(selected)
    setError(templateRes.error?.message ?? dayRes.error?.message ?? null)
    setLoading(false)
  }, [supabase])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  function editTemplate(template: TemplateWithDays) {
    setDraft({
      id: template.id,
      title: template.title,
      description: template.description ?? '',
      schedule_mode: template.schedule_mode,
      xp_reward: template.xp_reward,
      coin_reward: template.coin_reward,
      is_published: template.is_published,
      days: template.days.map((day) => ({ title: day.title, instructions: day.instructions, reflection_prompt: day.reflection_prompt ?? '' })),
    })
    setNotice(null)
  }

  function updateDay(index: number, key: keyof DayDraft, value: string) {
    setDraft((current) => ({ ...current, days: current.days.map((day, dayIndex) => dayIndex === index ? { ...day, [key]: value } : day) }))
  }

  function moveDay(index: number, direction: -1 | 1) {
    const next = index + direction
    if (next < 0 || next >= draft.days.length) return
    const days = [...draft.days]
    ;[days[index], days[next]] = [days[next], days[index]]
    setDraft({ ...draft, days })
  }

  function applyBulk() {
    const days = bulk.split('\n').map((line) => line.replace(/^\s*(?:day\s*)?\d+[.)\-:]?\s*/i, '').trim()).filter(Boolean)
      .map((line) => ({ title: line, instructions: line, reflection_prompt: 'What did you notice, and what will you try next time?' }))
    if (!days.length) return
    setDraft({ ...draft, days })
    setBulk('')
    setShowBulk(false)
  }

  function loadSocialSkillsExample() {
    setDraft({
      id: null,
      title: '30 Days of Social Skills',
      description: 'Build confidence through one practical social action each day.',
      schedule_mode: 'sequential',
      xp_reward: 750,
      coin_reward: 350,
      is_published: false,
      days: SOCIAL_SKILLS_DAYS.map((task) => ({ title: task, instructions: task, reflection_prompt: 'What happened, and what did you learn from the interaction?' })),
    })
  }

  async function save(publish = draft.is_published) {
    if (!draft.title.trim() || draft.days.some((day) => !day.title.trim() || !day.instructions.trim())) return
    setSaving(true); setError(null); setNotice(null)
    const { data, error: saveError } = await supabase.rpc('admin_save_challenge_template', {
      p_template_id: draft.id,
      p_title: draft.title.trim(),
      p_description: draft.description.trim(),
      p_schedule_mode: draft.schedule_mode,
      p_xp_reward: draft.xp_reward,
      p_coin_reward: draft.coin_reward,
      p_is_published: publish,
      p_days: draft.days,
    })
    if (saveError) setError(saveError.message)
    else { setNotice(publish ? 'Challenge published.' : 'Draft saved.'); await load(data as string) }
    setSaving(false)
  }

  async function togglePublished() {
    if (!draft.id) { await save(true); return }
    setSaving(true); setError(null); setNotice(null)
    const nextPublished = !draft.is_published
    const { error: publishError } = await supabase.from('challenge_templates').update({ is_published: nextPublished, updated_at: new Date().toISOString() }).eq('id', draft.id)
    if (publishError) setError(publishError.message)
    else { setNotice(nextPublished ? 'Challenge published.' : 'Challenge unpublished.'); await load(draft.id) }
    setSaving(false)
  }

  async function removeTemplate(template: TemplateWithDays) {
    if (!window.confirm(`Delete “${template.title}”? Enrollments and progress will also be deleted.`)) return
    const { error: deleteError } = await supabase.from('challenge_templates').delete().eq('id', template.id)
    if (deleteError) setError(deleteError.message)
    else { setDraft(blankDraft()); await load() }
  }

  return <div className="mx-auto max-w-[92rem] space-y-7">
    <AdminPageHeader eyebrow="Experiment · Guided programs" title="Challenge lab" description="Design day-by-day journeys, test their pacing, and publish only when the full experience is ready." />
    {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {notice && <p className="rounded-xl bg-primary/10 p-3 text-sm text-primary">{notice}</p>}

    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="self-start rounded-[2rem] bg-card p-4 ring-1 ring-border xl:sticky xl:top-10">
        <div className="flex items-center justify-between px-2 py-2"><div><p className="text-sm text-muted-foreground">Programs</p><p className="font-semibold">{templates.length} experiments</p></div><Button size="icon" onClick={() => setDraft(blankDraft())} aria-label="New challenge"><Plus /></Button></div>
        <div className="mt-3 space-y-2">
          {loading ? <p className="p-4 text-sm text-muted-foreground">Loading programs...</p> : templates.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No programs yet. Start with the social-skills example.</p> : templates.map((template) => <button key={template.id} onClick={() => editTemplate(template)} className={cn('w-full rounded-2xl p-3 text-left ring-1 transition-colors', draft.id === template.id ? 'bg-primary/10 ring-primary/30' : 'bg-muted/30 ring-border hover:bg-muted/60')}><div className="flex items-start justify-between gap-2"><p className="font-medium">{template.title}</p>{template.is_published ? <Eye className="size-4 shrink-0 text-primary" /> : <EyeOff className="size-4 shrink-0 text-muted-foreground" />}</div><p className="mt-1 text-xs text-muted-foreground">{template.duration_days} days · {template.schedule_mode}</p></button>)}
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={loadSocialSkillsExample}><Sparkles />Load social-skills example</Button>
      </aside>

      <section className="rounded-[2rem] bg-card p-5 ring-1 ring-border sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-muted-foreground">{draft.id ? 'Editing program' : 'New experiment'}</p><h2 className="text-2xl font-semibold tracking-tight">{draft.title || 'Untitled challenge'}</h2></div><div className="flex flex-wrap gap-2">{draft.id && <Button variant="ghost" size="icon" onClick={() => { const selected = templates.find((item) => item.id === draft.id); if (selected) void removeTemplate(selected) }} aria-label="Delete challenge"><Trash2 /></Button>}<Button variant="outline" onClick={() => setDraft({ ...draft, id: null, title: `${draft.title} copy`, is_published: false })} disabled={!draft.title}><Copy />Duplicate</Button><Button variant="outline" onClick={() => save(draft.is_published)} disabled={saving}><Save />Save changes</Button><Button onClick={togglePublished} disabled={saving}>{draft.is_published ? <><EyeOff />Unpublish</> : <><Eye />Publish</>}</Button></div></div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="program-title">Program title</Label><Input id="program-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="30 Days of Social Skills" /></div>
          <div className="space-y-2"><Label htmlFor="program-mode">Schedule</Label><select id="program-mode" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.schedule_mode} onChange={(event) => setDraft({ ...draft, schedule_mode: event.target.value as Draft['schedule_mode'] })}><option value="sequential">Sequential · one completed day at a time</option><option value="strict">Strict · no missed calendar days</option></select></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="program-description">Description</Label><Textarea id="program-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What transformation should the user experience?" /></div>
          <div className="space-y-2"><Label htmlFor="program-xp">Final XP reward</Label><Input id="program-xp" type="number" min={0} value={draft.xp_reward} onChange={(event) => setDraft({ ...draft, xp_reward: Number(event.target.value) })} /></div>
          <div className="space-y-2"><Label htmlFor="program-coins">Final coin reward</Label><Input id="program-coins" type="number" min={0} value={draft.coin_reward} onChange={(event) => setDraft({ ...draft, coin_reward: Number(event.target.value) })} /></div>
        </div>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Daily journey</p><h3 className="text-xl font-semibold">{draft.days.length} challenge days</h3></div><div className="flex gap-2"><Button variant="outline" onClick={() => setShowBulk(!showBulk)}>Bulk paste</Button><Button variant="outline" onClick={() => setDraft({ ...draft, days: [...draft.days, { title: '', instructions: '', reflection_prompt: '' }] })}><Plus />Add day</Button></div></div>
        {showBulk && <div className="mt-4 rounded-2xl bg-muted/40 p-4"><Label htmlFor="bulk-days">One challenge per line</Label><Textarea id="bulk-days" className="mt-2 min-h-40" value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder={'Day 1: Smile at three people\nDay 2: Start a short conversation'} /><Button className="mt-3" onClick={applyBulk}>Replace daily journey</Button></div>}
        <div className="mt-4 space-y-3">{draft.days.map((day, index) => <article key={index} className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border"><div className="flex items-center gap-2"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-background font-mono text-xs">{String(index + 1).padStart(2, '0')}</span><Input aria-label={`Day ${index + 1} title`} value={day.title} onChange={(event) => updateDay(index, 'title', event.target.value)} placeholder="Today’s action" /><Button size="icon" variant="ghost" onClick={() => moveDay(index, -1)} disabled={index === 0} aria-label="Move day up"><ArrowUp /></Button><Button size="icon" variant="ghost" onClick={() => moveDay(index, 1)} disabled={index === draft.days.length - 1} aria-label="Move day down"><ArrowDown /></Button><Button size="icon" variant="ghost" onClick={() => setDraft({ ...draft, days: draft.days.filter((_, dayIndex) => dayIndex !== index) })} disabled={draft.days.length === 1} aria-label="Delete day"><Trash2 /></Button></div><Textarea className="mt-3" aria-label={`Day ${index + 1} instructions`} value={day.instructions} onChange={(event) => updateDay(index, 'instructions', event.target.value)} placeholder="Clear instructions for completing this day" /><Input className="mt-3" aria-label={`Day ${index + 1} reflection prompt`} value={day.reflection_prompt} onChange={(event) => updateDay(index, 'reflection_prompt', event.target.value)} placeholder="Optional reflection prompt" /></article>)}</div>
      </section>
    </div>
  </div>
}

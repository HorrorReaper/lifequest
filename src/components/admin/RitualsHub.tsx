'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import {
  RITUAL_IDS,
  fillName,
  type RitualId,
  type RitualSetting,
  type RitualSettings,
} from '@/lib/rituals'
import { minutesToTime, timeToMinutes } from '@/lib/today-plan'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AdminPageHeader } from './AdminPageHeader'

export interface RitualsHubProps {
  userId: string
  /** hasTrustedAdminRole(user): only the JWT role may save. RLS enforces it; this only decides what to render. */
  trusted: boolean
  settings: RitualSettings
  templates: { id: string; name: string; icon: string }[]
}

const RITUAL_META: Record<RitualId, { label: string; blurb: string; weekly: boolean; journal: boolean }> = {
  daily_plan: {
    label: 'Daily Plan',
    blurb: 'The morning briefing. Opens the planner until today’s plan is committed.',
    weekly: false,
    journal: false,
  },
  evening_review: {
    label: 'Evening Review',
    blurb: 'Closes the day. Opens a journal template until today’s entry exists.',
    weekly: false,
    journal: true,
  },
  weekly_review: {
    label: 'Weekly Review',
    blurb: 'Closes the week. Opens a journal template until this week’s entry exists.',
    weekly: true,
    journal: true,
  },
  weekly_plan: {
    label: 'Weekly Plan',
    blurb: 'Opens the week. Opens a journal template until this week’s entry exists.',
    weekly: true,
    journal: true,
  },
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** The name the preview greets, so `{name}` reads as a person rather than a token. */
const PREVIEW_NAME = 'Alex'

/** The form's own shape: the time as the input holds it, the template as the select holds it. */
interface Draft {
  enabled: boolean
  weekday: number | null
  from: string
  templateId: string
  title: string
  description: string
  ctaLabel: string
}

function draftFrom(setting: RitualSetting): Draft {
  return {
    enabled: setting.enabled,
    weekday: setting.weekday,
    from: minutesToTime(setting.fromMinutes),
    templateId: setting.templateId ?? '',
    title: setting.title,
    description: setting.description,
    ctaLabel: setting.ctaLabel,
  }
}

function sameDraft(a: Draft, b: Draft) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function RitualsHub({ userId, trusted, settings, templates }: RitualsHubProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <AdminPageHeader
        eyebrow="Dashboard prompts"
        title="Rituals"
        description="When each ritual prompts, what it says, and where it leads. Changes apply to every user on their next dashboard visit."
      />
      {!trusted && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          These settings are read-only for allowlist admins. Saving needs the admin role on the account.
        </p>
      )}
      <div className="grid gap-5">
        {RITUAL_IDS.map((ritual) => (
          <RitualCard
            key={ritual}
            ritual={ritual}
            setting={settings[ritual]}
            templates={templates}
            userId={userId}
            trusted={trusted}
          />
        ))}
      </div>
    </div>
  )
}

function RitualCard({
  ritual,
  setting,
  templates,
  userId,
  trusted,
}: {
  ritual: RitualId
  setting: RitualSetting
  templates: RitualsHubProps['templates']
  userId: string
  trusted: boolean
}) {
  const meta = RITUAL_META[ritual]
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [saved, setSaved] = useState(() => draftFrom(setting))
  const [draft, setDraft] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const dirty = !sameDraft(draft, saved)
  const headingId = `ritual-${ritual}-heading`

  function patch(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }))
    setSavedAt(null)
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const fromMinutes = timeToMinutes(draft.from)
    if (!draft.title.trim() || !draft.description.trim() || !draft.ctaLabel.trim()) {
      setError('Title, description and call to action are required.')
      return
    }
    if (Number.isNaN(fromMinutes)) {
      setError('Pick a time the prompt may open from.')
      return
    }
    setSaving(true)
    const { error: saveError } = await supabaseUpdateWhere(
      supabase,
      'ritual_settings',
      {
        enabled: draft.enabled,
        weekday: meta.weekly ? draft.weekday : null,
        from_minutes: fromMinutes,
        template_id: meta.journal && draft.templateId ? draft.templateId : null,
        title: draft.title,
        description: draft.description,
        cta_label: draft.ctaLabel,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      'ritual',
      ritual
    )
    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    setSaved(draft)
    setSavedAt(Date.now())
    router.refresh()
  }

  const noTarget = meta.journal && draft.templateId === ''

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <div aria-labelledby={headingId} role="region" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={headingId} className="text-lg font-semibold">{meta.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
            </div>
            <Switch
              aria-label={`${meta.label} enabled`}
              checked={draft.enabled}
              disabled={!trusted}
              onCheckedChange={(next) => patch({ enabled: next })}
            />
          </div>

          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor={`ritual-${ritual}-weekday`}>Weekday</Label>
                {meta.weekly ? (
                  <select
                    id={`ritual-${ritual}-weekday`}
                    name="weekday"
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={draft.weekday ?? 0}
                    disabled={!trusted}
                    onChange={(event) => patch({ weekday: Number(event.target.value) })}
                  >
                    {WEEKDAYS.map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                ) : (
                  <p className="flex h-9 items-center text-sm text-muted-foreground">Every day</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ritual-${ritual}-from`}>From</Label>
                <Input
                  id={`ritual-${ritual}-from`}
                  name="from"
                  type="time"
                  value={draft.from}
                  disabled={!trusted}
                  onChange={(event) => patch({ from: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ritual-${ritual}-template`}>Opens</Label>
                {meta.journal ? (
                  <select
                    id={`ritual-${ritual}-template`}
                    name="template"
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={draft.templateId}
                    disabled={!trusted}
                    onChange={(event) => patch({ templateId: event.target.value })}
                  >
                    <option value="">— none —</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.icon} {template.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="flex h-9 items-center text-sm text-muted-foreground">Today’s planner</p>
                )}
                {noTarget && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Without a template this prompt will not show.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`ritual-${ritual}-title`}>Title</Label>
                <Input
                  id={`ritual-${ritual}-title`}
                  name="title"
                  value={draft.title}
                  disabled={!trusted}
                  onChange={(event) => patch({ title: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Preview: <span className="text-foreground">{fillName(draft.title, PREVIEW_NAME)}</span>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ritual-${ritual}-cta`}>Call to action</Label>
                <Input
                  id={`ritual-${ritual}-cta`}
                  name="cta"
                  value={draft.ctaLabel}
                  disabled={!trusted}
                  onChange={(event) => patch({ ctaLabel: event.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`ritual-${ritual}-description`}>Description</Label>
                <Textarea
                  id={`ritual-${ritual}-description`}
                  name="description"
                  rows={3}
                  value={draft.description}
                  disabled={!trusted}
                  onChange={(event) => patch({ description: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  <code>{'{name}'}</code> becomes the user’s name in any of these.
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {trusted && (
              <div className="flex items-center justify-end gap-3">
                {savedAt !== null && !dirty && (
                  <span className="text-xs text-muted-foreground">Saved</span>
                )}
                <Button type="submit" disabled={!dirty || saving}>
                  <BellRing className="mr-1.5 size-4" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

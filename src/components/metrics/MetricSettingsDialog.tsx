'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  METRIC_NAME_MAX,
  METRIC_UNIT_MAX,
  deleteMetric,
  updateMetric,
  validateMetricInput,
  type Metric,
  type MetricTargetDirection,
} from '@/lib/metrics'
import { parseDecimal } from '@/lib/decimal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface MetricTemplateOption {
  id: string
  name: string
  archived: boolean
  /** The template's `number` fields in field order, for re-pointing a legacy source field. */
  numberFields: { id: string; label: string }[]
}

interface MetricSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  metric: Metric
  /** The templates a metric can be asked in, including its own when archived. */
  templates: MetricTemplateOption[]
  /** The section the dialog puts the focus on when it opens. */
  focus?: 'target' | 'journal'
}

const DIRECTIONS: { value: MetricTargetDirection; label: string }[] = [
  { value: 'at_least', label: 'At least' },
  { value: 'at_most', label: 'At most' },
]

/**
 * A metric's name, unit, target and journal link, and its deletion. Everything is
 * saved together with one Save; deleting asks first, inside the dialog.
 */
export function MetricSettingsDialog({
  open,
  onOpenChange,
  metric,
  templates,
  focus,
}: MetricSettingsDialogProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [name, setName] = useState(metric.name)
  const [unit, setUnit] = useState(metric.unit ?? '')
  const [targetOn, setTargetOn] = useState(metric.targetValue !== null)
  const [direction, setDirection] = useState<MetricTargetDirection>(
    metric.targetDirection ?? 'at_least'
  )
  const [targetText, setTargetText] = useState(
    metric.targetValue !== null ? String(metric.targetValue) : ''
  )
  const [journalOn, setJournalOn] = useState(metric.templateId !== null)
  const [templateId, setTemplateId] = useState(metric.templateId ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  // Blocks a second submit in the same frame, before `busy` re-renders.
  const busyRef = useRef(false)
  const targetSwitchRef = useRef<HTMLElement | null>(null)
  const journalSwitchRef = useRef<HTMLElement | null>(null)
  const templateSelectRef = useRef<HTMLSelectElement | null>(null)

  // Every opening starts from the stored settings again, dropping what an
  // earlier, dismissed opening left behind.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(metric.name)
      setUnit(metric.unit ?? '')
      setTargetOn(metric.targetValue !== null)
      setDirection(metric.targetDirection ?? 'at_least')
      setTargetText(metric.targetValue !== null ? String(metric.targetValue) : '')
      setJournalOn(metric.templateId !== null)
      setTemplateId(metric.templateId ?? '')
      setConfirmingDelete(false)
      setError(null)
    }
  }

  const nameError = validateMetricInput({ name, unit })
  const parsedTarget = parseDecimal(targetText)
  const targetValid = !targetOn || parsedTarget !== null
  const journalValid = !journalOn || templateId !== ''
  const showArchived =
    journalOn && metric.templateArchived && templateId === metric.templateId

  /** Runs one write; a failure keeps the dialog open with `failure`. */
  async function run(write: () => Promise<void>, failure: string) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await write()
    } catch {
      setError(failure)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  /** The `number` field of the new template named like the metric, or null. */
  function sourceFieldFor(nextTemplateId: string | null): string | null {
    if (!nextTemplateId) return null
    const wanted = name.trim().toLowerCase()
    const template = templates.find((option) => option.id === nextTemplateId)
    return (
      template?.numberFields.find((field) => field.label.trim().toLowerCase() === wanted)?.id ??
      null
    )
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!targetValid || !journalValid || nameError) return
    const nextTemplateId = journalOn ? templateId : null
    void run(async () => {
      await updateMetric(supabase, metric.id, {
        name: name.trim(),
        unit: unit.trim() || null,
        targetValue: targetOn ? parsedTarget : null,
        targetDirection: targetOn ? direction : null,
        templateId: nextTemplateId,
        // The field that fed the metric belongs to the old template, so a
        // changed link clears it or re-points it. An unchanged link leaves it.
        ...(nextTemplateId !== metric.templateId && {
          sourceFieldId: sourceFieldFor(nextTemplateId),
        }),
      })
      router.refresh()
      onOpenChange(false)
    }, 'Could not save these settings. Please try again.')
  }

  function handleDelete() {
    void run(async () => {
      await deleteMetric(supabase, metric.id)
      router.push('/journal/metrics')
      onOpenChange(false)
    }, 'Could not delete this metric. Please try again.')
  }

  const noTemplates = templates.length === 0

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="max-h-[85svh] overflow-y-auto sm:max-w-sm"
        initialFocus={() => {
          if (focus === 'target') return targetSwitchRef.current
          if (focus === 'journal') return journalSwitchRef.current
          return true
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-xl">{metric.name} settings</DialogTitle>
          <DialogDescription>Name, unit, target and journal link.</DialogDescription>
        </DialogHeader>

        {confirmingDelete ? (
          <div className="space-y-4">
            <p className="font-medium">Delete {metric.name} and all its values?</p>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setConfirmingDelete(false)
                  setError(null)
                }}
              >
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={handleDelete}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="metric-settings-name">Name</Label>
              <Input
                id="metric-settings-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={METRIC_NAME_MAX}
                aria-invalid={nameError !== null}
                disabled={busy}
                className="h-11"
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="metric-settings-unit">Unit</Label>
              <Input
                id="metric-settings-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="e.g. kg"
                maxLength={METRIC_UNIT_MAX}
                disabled={busy}
                className="h-11"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Target</span>
                <Switch
                  ref={targetSwitchRef}
                  aria-label="Target"
                  checked={targetOn}
                  onCheckedChange={setTargetOn}
                  disabled={busy}
                />
              </div>
              {targetOn && (
                <div className="space-y-3">
                  <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
                    {DIRECTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={direction === option.value}
                        variant={direction === option.value ? 'default' : 'outline'}
                        disabled={busy}
                        onClick={() => setDirection(option.value)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metric-settings-target">Target value</Label>
                    <Input
                      id="metric-settings-target"
                      inputMode="decimal"
                      value={targetText}
                      onChange={(event) => setTargetText(event.target.value)}
                      placeholder={metric.unit ? `8000 ${metric.unit}` : '8000'}
                      disabled={busy}
                      className="h-11"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Also ask in my journal</span>
                <Switch
                  ref={journalSwitchRef}
                  aria-label="Also ask in my journal"
                  checked={journalOn}
                  onCheckedChange={setJournalOn}
                  disabled={busy || (noTemplates && !journalOn)}
                />
              </div>
              {noTemplates && !journalOn && (
                <p className="text-sm text-muted-foreground">
                  Create a journal template first to ask for this number there.
                </p>
              )}
              {journalOn && (
                <div className="space-y-2">
                  {showArchived && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <p className="text-muted-foreground">
                        Asked in {metric.templateName} (archived)
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => templateSelectRef.current?.focus()}
                      >
                        Change template
                      </Button>
                    </div>
                  )}
                  <Label htmlFor="metric-settings-template">Journal template</Label>
                  <select
                    id="metric-settings-template"
                    ref={templateSelectRef}
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    disabled={busy}
                    className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="">Choose a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.archived ? `${template.name} (archived)` : template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={busy || !targetValid || !journalValid || nameError !== null}
              className="w-full"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Saving…' : 'Save'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
              className="w-full text-destructive hover:text-destructive"
            >
              Delete metric
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target as TargetIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  deleteMetricTarget,
  upsertMetricTarget,
  type MetricTarget,
  type MetricTargetDirection,
} from '@/lib/metric-targets'
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

interface MetricTargetControlProps {
  userId: string
  fieldId: string
  label: string
  unit: string | null
  initial: MetricTarget | null
}

function describeTarget(target: MetricTarget, unit: string | null) {
  const direction = target.direction === 'at_least' ? 'At least' : 'At most'
  return unit
    ? `${direction} ${target.targetValue} ${unit}`
    : `${direction} ${target.targetValue}`
}

/**
 * Sets one metric's target, next to the chart that shows where it stands.
 *
 * That placement is the point: a target is a number you can only judge
 * against the history already on this page.
 */
export function MetricTargetControl({
  userId,
  fieldId,
  label,
  unit,
  initial,
}: MetricTargetControlProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()

  const [target, setTarget] = useState<MetricTarget | null>(initial)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(initial ? String(initial.targetValue) : '')
  const [direction, setDirection] = useState<MetricTargetDirection>(
    initial?.direction ?? 'at_least'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const parsed = Number(value)
    // An empty field parses to 0, which is a legitimate target -- so the
    // blank has to be rejected before the number is looked at.
    if (value.trim() === '' || !Number.isFinite(parsed)) return

    setSaving(true)
    setError(null)
    try {
      await upsertMetricTarget(supabase, userId, {
        fieldId,
        targetValue: parsed,
        direction,
      })
      setTarget({ fieldId, targetValue: parsed, direction })
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not save this target. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    setError(null)
    try {
      await deleteMetricTarget(supabase, userId, fieldId)
      setTarget(null)
      setValue('')
      setDirection('at_least')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not remove this target. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full justify-start"
      >
        <TargetIcon />
        {target ? describeTarget(target, unit) : 'Set a target'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Target for {label}</DialogTitle>
            <DialogDescription>
              A metric with a target shows up on your dashboard.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`target-direction-${fieldId}`}>Direction</Label>
              <select
                id={`target-direction-${fieldId}`}
                value={direction}
                onChange={(event) =>
                  setDirection(event.target.value as MetricTargetDirection)
                }
                className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="at_least">At least</option>
                <option value="at_most">At most</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`target-value-${fieldId}`}>Target</Label>
              <Input
                id={`target-value-${fieldId}`}
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={unit ? `8000 ${unit}` : '8000'}
                autoFocus
                className="h-11"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              {target ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleRemove()}
                  disabled={saving}
                  className="text-destructive"
                >
                  Remove target
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save target'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

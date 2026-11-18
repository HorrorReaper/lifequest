'use client'

import { useEffect, useState } from 'react'
import { Loader2, Moon, Share, Sun, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  disableReminder,
  enablePush,
  pushSupport,
  readReminders,
  sendTestPush,
  vapidPublicKey,
  type PushSupport,
  type ReminderSwitches,
} from '@/lib/push-client'
import type { ReminderKind } from '@/lib/push-subscription'

/**
 * Morning and evening reminders for this device
 * (docs/features/push-notifications.md). Each switch turns its reminder on
 * or off only in the browser it is flipped in; every device opts in on its
 * own.
 */

type Status = { tone: 'muted' | 'error'; text: string } | null

const REMINDERS: Array<{ kind: ReminderKind; label: string; hint: string; icon: LucideIcon }> = [
  {
    kind: 'daily_plan',
    label: 'Morning planning reminder',
    hint: 'In the morning, until today’s plan is set.',
    icon: Sun,
  },
  {
    kind: 'evening_review',
    label: 'Evening review reminder',
    hint: 'When your evening review opens, until you have written it.',
    icon: Moon,
  },
]

const OFF: ReminderSwitches = { daily_plan: false, evening_review: false }

export function PushReminderCard() {
  // Unknown until mounted: support and the existing subscription can only be
  // read in the browser, and the server render must not guess.
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [enabled, setEnabled] = useState<ReminderSwitches>(OFF)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    let cancelled = false
    async function detect() {
      const detected = pushSupport()
      const switches = detected === 'supported' ? await readReminders().catch(() => OFF) : OFF
      if (cancelled) return
      setEnabled(switches)
      setSupport(detected)
    }
    void detect()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(kind: ReminderKind, label: string, next: boolean) {
    setBusy(true)
    setStatus(null)
    if (next) {
      const result = await enablePush(kind)
      if (result.ok) {
        setEnabled((current) => ({ ...current, [kind]: true }))
        setStatus({ tone: 'muted', text: `${label} is on for this device.` })
      } else if (result.reason === 'denied') {
        setStatus({
          tone: 'error',
          text: 'Notifications are blocked for LifeQuest. Allow them in your browser or system settings, then try again.',
        })
      } else if (result.reason === 'not-configured') {
        setStatus({ tone: 'error', text: 'Push notifications are not configured on the server yet.' })
      } else {
        setStatus({ tone: 'error', text: `Could not turn the ${label.toLowerCase()} on. Try again.` })
      }
    } else {
      const otherStillOn = REMINDERS.some((reminder) => reminder.kind !== kind && enabled[reminder.kind])
      if (await disableReminder(kind, otherStillOn)) {
        setEnabled((current) => ({ ...current, [kind]: false }))
        setStatus({ tone: 'muted', text: `${label} is off for this device.` })
      } else {
        setStatus({ tone: 'error', text: `Could not turn the ${label.toLowerCase()} off. Try again.` })
      }
    }
    setBusy(false)
  }

  async function test() {
    setTesting(true)
    setStatus(null)
    const result = await sendTestPush()
    setStatus(
      result.ok
        ? { tone: 'muted', text: 'Test notification sent. It can take a few seconds to arrive.' }
        : { tone: 'error', text: result.error }
    )
    setTesting(false)
  }

  const configured = vapidPublicKey() !== null
  const anyOn = REMINDERS.some((reminder) => enabled[reminder.kind])

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Reminders on this device to plan your day and to write your evening review. Turn them on on each phone or
          computer you want them on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {support === 'ios-needs-install' ? (
          <div className="flex items-start gap-3 rounded-xl border bg-muted/25 p-4 text-sm">
            <Share className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="leading-relaxed text-muted-foreground">
              On iPhone and iPad, reminders need LifeQuest on your home screen. Tap the Share button, choose
              &ldquo;Add to Home Screen&rdquo;, then open LifeQuest from there and come back to Settings.
            </p>
          </div>
        ) : support === 'unsupported' ? (
          <p className="rounded-xl border bg-muted/25 p-4 text-sm text-muted-foreground">
            This browser does not support notifications.
          </p>
        ) : (
          <>
            <div className="divide-y rounded-xl border bg-muted/25">
              {REMINDERS.map(({ kind, label, hint, icon: Icon }) => {
                const id = `push-${kind.replace('_', '-')}`
                return (
                  <div key={kind} className="flex items-start justify-between gap-4 p-4">
                    <div className="flex min-w-0 gap-3">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0 space-y-1">
                        <Label htmlFor={id} className="text-sm font-semibold">
                          {label}
                        </Label>
                        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
                      </div>
                    </div>
                    <Switch
                      id={id}
                      checked={enabled[kind]}
                      onCheckedChange={(next) => toggle(kind, label, next)}
                      disabled={support === null || busy || !configured}
                      aria-describedby="push-reminder-status"
                    />
                  </div>
                )
              })}
            </div>

            {anyOn && (
              <Button type="button" variant="outline" size="sm" onClick={test} disabled={testing}>
                {testing && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Send test notification
              </Button>
            )}
          </>
        )}

        <div id="push-reminder-status" aria-live="polite" className="text-xs leading-relaxed">
          {!configured && support === 'supported' ? (
            <p className="text-muted-foreground">Push notifications are not configured on the server yet.</p>
          ) : status ? (
            <p className={status.tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{status.text}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

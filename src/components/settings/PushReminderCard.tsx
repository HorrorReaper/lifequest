'use client'

import { useEffect, useState } from 'react'
import { Bell, Loader2, Share } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  sendTestPush,
  vapidPublicKey,
  type PushSupport,
} from '@/lib/push-client'

/**
 * Evening review reminder for this device (docs/features/push-notifications.md).
 * The switch subscribes or unsubscribes only the browser it is flipped in;
 * every device opts in on its own.
 */

type Status = { tone: 'muted' | 'error'; text: string } | null

export function PushReminderCard() {
  // Unknown until mounted: support and the existing subscription can only be
  // read in the browser, and the server render must not guess.
  const [support, setSupport] = useState<PushSupport | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    let cancelled = false
    async function detect() {
      const detected = pushSupport()
      const subscription = detected === 'supported' ? await currentSubscription().catch(() => null) : null
      if (cancelled) return
      setEnabled(Boolean(subscription) && Notification.permission === 'granted')
      setSupport(detected)
    }
    void detect()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(next: boolean) {
    setBusy(true)
    setStatus(null)
    if (next) {
      const result = await enablePush()
      if (result.ok) {
        setEnabled(true)
        setStatus({ tone: 'muted', text: 'Reminders are on for this device.' })
      } else if (result.reason === 'denied') {
        setStatus({
          tone: 'error',
          text: 'Notifications are blocked for LifeQuest. Allow them in your browser or system settings, then try again.',
        })
      } else if (result.reason === 'not-configured') {
        setStatus({ tone: 'error', text: 'Push notifications are not configured on the server yet.' })
      } else {
        setStatus({ tone: 'error', text: 'Could not turn reminders on. Try again.' })
      }
    } else {
      const ok = await disablePush()
      if (ok) {
        setEnabled(false)
        setStatus({ tone: 'muted', text: 'Reminders are off for this device.' })
      } else {
        setStatus({ tone: 'error', text: 'Could not turn reminders off. Try again.' })
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

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Get a reminder on this device when your evening review opens.</CardDescription>
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
            <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/25 p-4">
              <div className="flex min-w-0 gap-3">
                <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <Label htmlFor="push-evening-review" className="text-sm font-semibold">
                    Evening review reminder
                  </Label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Only this device. Turn it on on each phone or computer you want reminders on.
                  </p>
                </div>
              </div>
              <Switch
                id="push-evening-review"
                checked={enabled}
                onCheckedChange={toggle}
                disabled={support === null || busy || !configured}
                aria-describedby="push-evening-review-status"
              />
            </div>

            {enabled && (
              <Button type="button" variant="outline" size="sm" onClick={test} disabled={testing}>
                {testing && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Send test notification
              </Button>
            )}
          </>
        )}

        <div id="push-evening-review-status" aria-live="polite" className="text-xs leading-relaxed">
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

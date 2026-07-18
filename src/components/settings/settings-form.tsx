'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { supabaseUpdateWhere } from '@/lib/supabase/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, Trash2 } from 'lucide-react'
import { useTheme, type Theme } from '@/components/providers/theme-provider'
import { cn } from '@/lib/utils'

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

const APPEARANCE_OPTIONS: { value: Theme; title: string; description: string }[] = [
  {
    value: 'white',
    title: 'White Mode',
    description: 'Calm, bright, and lower intensity.',
  },
  {
    value: 'system',
    title: 'System',
    description: 'Follow your device appearance.',
  },
  {
    value: 'dark',
    title: 'Dark',
    description: 'The classic LifeQuest look.',
  },
]

interface SettingsFormProps {
  userId: string
  email: string
  username: string
  timezone: string
  aiAssistantEnabled: boolean
  aiConsentAt: string | null
}

export function SettingsForm({
  userId,
  email,
  username: initialUsername,
  timezone: initialTimezone,
  aiAssistantEnabled: initialAiAssistantEnabled,
  aiConsentAt: initialAiConsentAt,
}: SettingsFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const [username, setUsername] = useState(initialUsername)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [aiAssistantEnabled, setAiAssistantEnabled] = useState(initialAiAssistantEnabled)
  const [aiConsentAt, setAiConsentAt] = useState(initialAiConsentAt)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setProfileError(null)

    const { error } = await supabaseUpdateWhere(
      supabase,
      'profiles',
      {
        username: username.trim(),
        timezone,
        updated_at: new Date().toISOString(),
      },
      'id',
      userId
    )

    setSaving(false)
    if (error) {
      setProfileError('We could not save your profile. Please try again.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleAiConsent(enabled: boolean) {
    setAiSaving(true)
    setAiError(null)
    const consentAt = enabled ? new Date().toISOString() : null

    const { error } = await supabaseUpdateWhere(
      supabase,
      'profiles',
      {
        ai_assistant_enabled: enabled,
        ai_consent_at: consentAt,
        updated_at: new Date().toISOString(),
      },
      'id',
      userId
    )

    if (error) {
      setAiError('We could not update your AI privacy preference. Please try again.')
    } else {
      setAiAssistantEnabled(enabled)
      setAiConsentAt(consentAt)
      window.dispatchEvent(
        new CustomEvent('lifequest-ai-consent-changed', { detail: { enabled } })
      )
    }

    setAiSaving(false)
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation.trim().toLowerCase() !== email.trim().toLowerCase()) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(data.error ?? 'We could not delete your account.')
      }

      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
      window.location.assign('/login?account=deleted')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'We could not delete your account.')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how LifeQuest should feel on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {APPEARANCE_OPTIONS.map((option) => {
              const selected = theme === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-all hover:border-foreground/30 hover:bg-muted/60",
                    selected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/15"
                      : "border-border/60 bg-background"
                  )}
                  aria-pressed={selected}
                >
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>AI &amp; privacy</CardTitle>
          <CardDescription>
            The assistant is optional and stays off until you explicitly enable contextual AI processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border bg-muted/25 p-4">
            <div className="min-w-0 space-y-1">
              <Label htmlFor="ai-assistant-consent" className="text-sm font-semibold">
                Contextual AI assistant
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                When enabled, your messages and relevant recent tasks, habits, and journal responses may be sent to OpenRouter and the selected model provider to answer your request.
              </p>
            </div>
            <Switch
              id="ai-assistant-consent"
              checked={aiAssistantEnabled}
              onCheckedChange={handleAiConsent}
              disabled={aiSaving}
              aria-describedby="ai-assistant-status"
            />
          </div>

          <div id="ai-assistant-status" className="text-xs leading-relaxed text-muted-foreground">
            {aiAssistantEnabled ? (
              <p>
                Enabled{aiConsentAt ? ` since ${new Date(aiConsentAt).toLocaleDateString()}` : ''}. You can withdraw consent at any time; future AI requests will be blocked immediately.
              </p>
            ) : (
              <p>Disabled. LifeQuest will not send your app context to the AI provider.</p>
            )}
          </div>

          {aiError && <p className="text-xs text-destructive">{aiError}</p>}

          <Link
            href="/privacy#ai-assistant"
            className="inline-flex text-xs font-medium text-primary underline underline-offset-4"
          >
            Read how AI processing works
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="opacity-60" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Display Name</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
          </Button>
          {profileError && <p className="text-xs text-destructive">{profileError}</p>}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/25 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently remove your account and LifeQuest data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              setDeleteConfirmation('')
              setDeleteError(null)
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="size-4" />
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your journal entries, tasks, habits, routines, goals, progress, and account. Enter <strong className="font-semibold text-foreground">{email}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delete-account-confirmation">Account email</Label>
            <Input
              id="delete-account-confirmation"
              type="email"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoComplete="off"
              disabled={deleting}
            />
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Keep account
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={
                deleting || deleteConfirmation.trim().toLowerCase() !== email.trim().toLowerCase()
              }
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

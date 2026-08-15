'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AuthLoadingOverlay } from '@/components/auth/auth-loading-overlay'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const MIN_PASSWORD_LENGTH = 8

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set right before the successful router.push and never cleared afterward;
  // see auth-loading-overlay.tsx for why the (app) layout needs this.
  const [navigating, setNavigating] = useState(false)

  const mismatch = confirmation.length > 0 && password !== confirmation

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (password !== confirmation) {
      setError('Both passwords must match.')
      return
    }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // The recovery link already established a session, so the user stays signed
    // in. Middleware sends them on to onboarding if it is still incomplete.
    setNavigating(true)
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <>
      <Card className="border-white/15 bg-background/92 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>
            {email
              ? `You are resetting the password for ${email}.`
              : 'Pick a password you have not used before.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    autoFocus
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <FieldDescription>
                  At least {MIN_PASSWORD_LENGTH} characters.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={loading}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                />
                {mismatch && (
                  <FieldDescription className="text-destructive">
                    Both passwords must match.
                  </FieldDescription>
                )}
              </Field>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Field>
                <Button
                  type="submit"
                  disabled={loading || mismatch || password.length === 0}
                  className="w-full"
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {loading ? 'Saving...' : 'Save new password'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {navigating && <AuthLoadingOverlay label="Signing you in…" />}
    </>
  )
}

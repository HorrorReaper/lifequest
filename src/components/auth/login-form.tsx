'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
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

type AuthMode = 'signin' | 'signup' | 'reset'

// Codes are set by /auth/callback and the reset-password route, which cannot
// render UI themselves.
const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed:
    'We could not complete that sign-in. Please try again.',
  reset_link_invalid:
    'That password reset link is invalid or has expired. Request a new one below.',
}

const COPY: Record<AuthMode, { title: string; description: string; submit: string }> = {
  signin: {
    title: 'Welcome back',
    description: 'Journal daily, earn XP, and build a city around your progress.',
    submit: 'Sign In',
  },
  signup: {
    title: 'Create your LifeQuest account',
    description: 'Journal daily, earn XP, and build a city around your progress.',
    submit: 'Create Account',
  },
  reset: {
    title: 'Reset your password',
    description: 'We will email you a link to choose a new password.',
    submit: 'Send reset link',
  },
}

export function LoginForm({
  className,
  accountDeleted = false,
  defaultSignUp = false,
  errorCode = null,
  ...props
}: React.ComponentProps<'div'> & {
  accountDeleted?: boolean
  defaultSignUp?: boolean
  errorCode?: string | null
}) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<AuthMode>(defaultSignUp ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  // Set right before a successful router.push and deliberately never cleared
  // afterward — the overlay must stay up for the whole gap until the new
  // route actually paints, which unmounts this component for us.
  const [navigatingLabel, setNavigatingLabel] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(
    accountDeleted ? 'Your account and LifeQuest data were deleted.' : null
  )
  const [error, setError] = useState<string | null>(
    errorCode ? ERROR_MESSAGES[errorCode] ?? 'Something went wrong. Please try again.' : null
  )

  const copy = COPY[mode]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (error) setError(error.message)
      else {
        // Deliberately not revealing whether the address has an account.
        setMessage(
          'If an account exists for that email, a reset link is on its way.'
        )
      }
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // With email confirmation disabled, Supabase returns a live session and
      // no mail is ever sent — telling the user to check their inbox would
      // strand them on this page while already signed in.
      if (data.session) {
        setNavigatingLabel('Setting up your account…')
        router.push('/onboarding')
        router.refresh()
        return
      }

      setMessage('Check your email for a confirmation link.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setNavigatingLabel('Signing you in…')
    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogleAuth() {
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setMessage(null)
    setShowPassword(false)
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="border-white/15 bg-background/92 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              {mode !== 'reset' && (
                <>
                  <Field>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={loading}
                    >
                      <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden>
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      Continue with Google
                    </Button>
                  </Field>

                  <div
                    className="flex items-center gap-3 py-1"
                    role="separator"
                    aria-label="Email sign in"
                  >
                    <span className="h-px flex-1 bg-border/65" />
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                      or use email
                    </span>
                    <span className="h-px flex-1 bg-border/65" />
                  </div>
                </>
              )}

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                  inputMode="email"
                />
              </Field>

              {mode !== 'reset' && (
                <Field>
                  <div className="flex items-center">
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground hover:cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      // Only enforced when choosing a password. Applying it to
                      // sign-in would block accounts created under an older,
                      // shorter minimum from even submitting the form.
                      minLength={mode === 'signup' ? 8 : undefined}
                      autoComplete={
                        mode === 'signup' ? 'new-password' : 'current-password'
                      }
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {mode === 'signup' && (
                    <FieldDescription>At least 8 characters.</FieldDescription>
                  )}
                </Field>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {message && (
                <p className="text-sm text-green-600 dark:text-green-400">{message}</p>
              )}

              <Field>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Working...' : copy.submit}
                </Button>

                {mode === 'reset' ? (
                  <FieldDescription className="text-center">
                    Remembered it?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="font-medium text-foreground underline underline-offset-4 hover:cursor-pointer"
                    >
                      Back to sign in
                    </button>
                  </FieldDescription>
                ) : (
                  <FieldDescription className="text-center">
                    {mode === 'signup'
                      ? 'Already have an account?'
                      : "Don't have an account?"}{' '}
                    <button
                      type="button"
                      onClick={() =>
                        switchMode(mode === 'signup' ? 'signin' : 'signup')
                      }
                      className="font-medium text-foreground underline underline-offset-4 hover:cursor-pointer"
                    >
                      {mode === 'signup' ? 'Sign in' : 'Create your account'}
                    </button>
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center text-white/70 [&_a]:text-white">
        By continuing, you agree to our{' '}
        <Link href="/terms" className="underline underline-offset-4">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline underline-offset-4">
          Privacy Policy
        </Link>
        .
      </FieldDescription>

      {navigatingLabel && <AuthLoadingOverlay label={navigatingLabel} />}
    </div>
  )
}

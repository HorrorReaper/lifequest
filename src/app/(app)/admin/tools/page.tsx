import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { AdminTestingTools } from '@/components/dev/AdminTestingTools'
import { SignupAnalytics } from '@/components/admin/SignupAnalytics'
import { BetaActivation } from '@/components/admin/BetaActivation'
import { buildActivationSteps } from '@/lib/activation'
import { hasTrustedAdminRole } from '@/lib/admin'
import { dateInTimezone } from '@/lib/dates'
import {
  buildSignupSeries,
  parseSignupRange,
  signupBaseline,
  signupRangeStart,
} from '@/lib/signup-analytics'

export default async function AdminToolsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string | string[] }>
}) {
  const range = parseSignupRange(searchParams ? (await searchParams).range : undefined)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // The signup RPCs count only for a trusted admin (JWT role), so an
  // allowlist-only admin is told why instead of being shown zeros.
  const trusted = hasTrustedAdminRole(user)
  // UTC, because that is how admin_signup_series buckets days.
  const today = dateInTimezone(new Date(), 'UTC')
  const since = signupRangeStart(today, range)

  const untyped = supabase as unknown as SupabaseClient
  const [{ data }, seriesResult, statsResult, funnelResult, feedbackResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle(),
    // Untyped for the call, as WorkoutHub and NutritionHub do: the generated
    // types resolve every RPC's arguments to undefined with this postgrest-js.
    trusted
      ? (supabase as unknown as SupabaseClient).rpc('admin_signup_series', { p_since: since })
      : null,
    trusted ? supabase.rpc('admin_app_stats').single() : null,
    trusted ? untyped.rpc('admin_activation_funnel', { p_since: since }) : null,
    trusted ? untyped.rpc('admin_beta_feedback', { p_limit: 20 }) : null,
  ])
  const activationUnavailable = !trusted
    ? 'untrusted'
    : funnelResult?.error || feedbackResult?.error
      ? 'error'
      : null
  const onboardingComplete = (data as { onboarding_complete?: boolean } | null)?.onboarding_complete ?? true

  const daily = buildSignupSeries(seriesResult?.data, since, today)
  const stats = statsResult?.data as { total_users: number; waitlist_signups: number } | null | undefined
  const baseline = signupBaseline(
    { waitlist: stats?.waitlist_signups ?? null, users: stats?.total_users ?? null },
    daily
  )
  const unavailable = !trusted
    ? 'untrusted'
    : seriesResult?.error || statsResult?.error
      ? 'error'
      : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Growth, QA and diagnostics</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Tools</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Follow signups over time, then exercise client state, animations, and important MVP routes
          without touching production data.
        </p>
      </header>
      <SignupAnalytics range={range} daily={daily} baseline={baseline} unavailable={unavailable} />
      <BetaActivation
        since={since}
        steps={buildActivationSteps(funnelResult?.data)}
        feedback={(feedbackResult?.data as Parameters<typeof BetaActivation>[0]['feedback']) ?? null}
        unavailable={activationUnavailable}
      />

      <AdminTestingTools userId={user.id} onboardingComplete={onboardingComplete} />
    </div>
  )
}

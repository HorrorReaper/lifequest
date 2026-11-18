// src/app/onboarding/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow'
import { clockFromMinutes, type OnboardingTemplate } from '@/lib/onboarding'
import { normalizeRitualSettings } from '@/lib/rituals'
import type { Database } from '@/lib/supabase/database.types'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data }, { data: templateRows }, { data: ritualRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('journal_templates')
      .select('id, name, description, entry_type, xp_reward, sort_order')
      .eq('is_system', true)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('ritual_settings').select('*'),
  ])
  const profile = data as Database['public']['Tables']['profiles']['Row'] | null

  // Existing accounts never see this flow again, so nothing they have is
  // touched by it.
  if (profile?.onboarding_complete) redirect('/dashboard')

  // The reminder times the push sends at, as the admin set them. A ritual
  // that is off, or has no time to send at, is not offered.
  const rituals = normalizeRitualSettings(ritualRows)
  const reminderTimes = {
    daily_plan:
      rituals.daily_plan.enabled && rituals.daily_plan.reminderMinutes !== null
        ? clockFromMinutes(rituals.daily_plan.reminderMinutes)
        : null,
    evening_review:
      rituals.evening_review.enabled && rituals.evening_review.templateId
        ? clockFromMinutes(rituals.evening_review.fromMinutes)
        : null,
  }

  return (
    // Plain background on purpose; the trail scene is the colour.
    <div className="flex min-h-svh justify-center bg-background sm:items-center sm:py-8">
      <OnboardingFlow
        userId={user.id}
        currentName={profile?.username ?? user.user_metadata?.full_name ?? ''}
        templates={(templateRows ?? []) as OnboardingTemplate[]}
        reminderTimes={reminderTimes}
      />
    </div>
  )
}

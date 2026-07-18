import { createClient } from '@/lib/supabase/server'
import { NutritionHub } from '@/components/admin/NutritionHub'

function dateInTimezone(timezone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }

export default async function NutritionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user!.id).single()
  const timezone = (profile as { timezone: string } | null)?.timezone ?? 'Europe/Berlin'
  return <NutritionHub userId={user!.id} initialDate={dateInTimezone(timezone)} />
}

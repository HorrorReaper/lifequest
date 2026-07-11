import { createClient } from '@/lib/supabase/server'
import { WorkoutHub } from '@/components/admin/WorkoutHub'

export default async function WorkoutsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <WorkoutHub userId={user!.id} />
}

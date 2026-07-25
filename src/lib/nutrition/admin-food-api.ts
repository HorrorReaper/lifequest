import 'server-only'

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin'

export async function authenticatedFoodApi(): Promise<
  { user: User; supabase: SupabaseClient; response?: never }
  | { user?: never; supabase?: never; response: Response }
> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: Response.json({ error: 'Authentication required.' }, { status: 401 }) }
  if (!isAdminUser(user) || user.app_metadata?.role !== 'admin') {
    return { response: Response.json({ error: 'Trusted admin access required.' }, { status: 403 }) }
  }
  return { user, supabase: supabase as unknown as SupabaseClient }
}

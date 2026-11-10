import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

/**
 * The Supabase client for public route handlers that write on behalf of an
 * anonymous visitor (/api/waitlist, /api/landing-events).
 *
 * Prefers SUPABASE_SERVICE_ROLE_KEY, which is what allows the tables behind
 * these routes to refuse anonymous writes in RLS. Without that variable it
 * falls back to the publishable key the browser has as well, so the routes
 * work before the key is set and closing a table down later is a change of
 * environment rather than of code.
 *
 * Returns null when the Supabase environment variables are missing.
 */
export function createPublicRouteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) return null

  return createClient<Database>(url, key, {
    // Nothing here is acting as a signed-in user, and a route handler has no
    // session to keep between requests.
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

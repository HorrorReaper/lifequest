// src/lib/supabase/server.ts

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
            // The `getAll` method is called from a Server Component. This function does the following:
            // 1. Retrieves all cookies from the incoming request using `cookies()`.
            // 2. Returns the cookies in a format that Supabase can use for authentication and session management.
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
            // The `setAll` method is called from a Server Component.
            // This function does the following:
            // 1. Iterates through the list of cookies to set.
            // 2. Sets each cookie using the `cookieStore.set()` method.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

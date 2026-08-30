import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Only run proxy for routes that need auth/session checks.
  //
  // Every authenticated route belongs here. A route left out does not get its
  // Supabase session refreshed, so an expired access token sends the user to
  // /login even though the refresh token is still valid, and the onboarding
  // gate does not apply to it either.
  matcher: [
    '/dashboard/:path*',
    '/dashboard2/:path*',
    '/admin/:path*',
    '/journal/:path*',
    '/plan/:path*',
    '/city/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/routines/:path*',
    '/onboarding/:path*',
    '/tasks/:path*',
    '/habits/:path*',
    '/quests/:path*',
    '/learn/:path*',
    '/learnings/:path*',
    '/analytics/:path*',
    '/api/:path*',
  ],
}

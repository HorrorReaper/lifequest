import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Only run proxy for routes that need auth/session checks.
  matcher: [
    '/dashboard/:path*',
    '/journal/:path*',
    '/city/:path*',
    '/settings/:path*',
    '/onboarding/:path*',
    '/api/:path*',
  ],
}

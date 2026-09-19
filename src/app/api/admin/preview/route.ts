import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { PREVIEW_AS_USER_COOKIE, isAdminUser } from '@/lib/admin'

/**
 * Turns "preview as a normal user" on and off.
 *
 * Entering requires being an admin -- not because the cookie is dangerous
 * (it only ever removes admin interface, never grants any) but because there
 * is nothing for a non-admin to preview. Leaving is deliberately open to any
 * signed-in user, so nobody can be stranded in preview by a stale cookie.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let enabled: boolean
  try {
    const body = (await request.json()) as { enabled?: unknown }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }
    enabled = body.enabled
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const cookieStore = await cookies()

  if (!enabled) {
    cookieStore.delete(PREVIEW_AS_USER_COOKIE)
    return NextResponse.json({ previewing: false })
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  cookieStore.set(PREVIEW_AS_USER_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })

  return NextResponse.json({ previewing: true })
}

import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

interface DeleteAccountBody {
  confirmation?: unknown
}

export async function DELETE(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get('origin')

  if (origin && origin !== requestOrigin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Sign in again before deleting your account.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as DeleteAccountBody
  const confirmation = typeof body.confirmation === 'string' ? body.confirmation.trim() : ''
  const email = user.email?.trim() ?? ''

  if (!email || confirmation.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: 'Enter your account email exactly to confirm deletion.' }, { status: 400 })
  }

  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secretKey) {
    return NextResponse.json(
      { error: 'Account deletion is not configured on the server.' },
      { status: 503 }
    )
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Revoke refresh tokens before deleting the Auth user. Existing access tokens
  // remain valid until their short expiry, as documented by Supabase.
  await supabase.auth.signOut({ scope: 'global' })

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    return NextResponse.json(
      { error: 'We could not delete your account. Please try again or contact support.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted: true })
}

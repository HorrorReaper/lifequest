// src/app/auth/callback/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseInsert } from '@/lib/supabase/helpers'

interface AuthProfileState {
  id: string
  onboarding_complete: boolean
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const explicitNext = searchParams.get('next')

  if (code) {
    // Exchange the authorization code for a session
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if profile exists, if not create one
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let profileComplete = false

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, onboarding_complete')
          .eq('id', user.id)
          .single()
        const profile = profileData as AuthProfileState | null

        if (!profile) {
          await supabaseInsert(supabase, 'profiles', {
            id: user.id,
            username: user.user_metadata?.full_name ?? null,
            avatar_url: user.user_metadata?.avatar_url ?? null,
          })
        } else {
          profileComplete = Boolean(profile.onboarding_complete)
        }
      }

      const next = explicitNext ?? (profileComplete ? '/dashboard' : '/onboarding')
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}

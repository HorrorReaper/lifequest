import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPublicChallenge, startChallengeProgram } from '@/lib/challenge-programs'
import { CHALLENGE_INTENT_COOKIE, CHALLENGE_INTENT_MAX_AGE } from '@/lib/challenge-intent'
import { isValidChallengeSlug } from '@/lib/challenge-rules'

/**
 * The landing page's "Start" button.
 *
 * - Signed out: remember the challenge in a cookie and go to sign-up.
 * - Signed in, not onboarded: remember it and finish onboarding first; the
 *   middleware sends the user back here from the dashboard afterwards.
 * - Signed in and onboarded: start it (idempotent) and open it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params
  const slug = rawSlug.trim().toLowerCase()
  const to = (path: string) => new URL(path, request.url)

  if (!isValidChallengeSlug(slug)) return NextResponse.redirect(to('/'))

  const supabase = await createClient()
  const challenge = await fetchPublicChallenge(supabase, slug)
  if (!challenge) {
    const response = NextResponse.redirect(to('/'))
    response.cookies.delete(CHALLENGE_INTENT_COOKIE)
    return response
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const remember = (response: NextResponse) => {
    response.cookies.set(CHALLENGE_INTENT_COOKIE, slug, {
      path: '/',
      maxAge: CHALLENGE_INTENT_MAX_AGE,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    })
    return response
  }

  if (!user) {
    return remember(NextResponse.redirect(to(`/login?mode=signup&challenge=${encodeURIComponent(slug)}`)))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .maybeSingle()
  if (!(profile as { onboarding_complete?: boolean } | null)?.onboarding_complete) {
    return remember(NextResponse.redirect(to('/onboarding')))
  }

  let destination = `/challenges/${challenge.id}`
  try {
    await startChallengeProgram(supabase, challenge.id)
  } catch (error) {
    console.error('Could not start challenge from landing page', error)
    destination = '/challenges'
  }

  const response = NextResponse.redirect(to(destination))
  response.cookies.delete(CHALLENGE_INTENT_COOKIE)
  return response
}

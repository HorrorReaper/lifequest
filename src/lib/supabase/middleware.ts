// src/lib/supabase/middleware.ts

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  CHALLENGE_INTENT_COOKIE,
  challengeJoinPath,
  readChallengeIntent,
} from '@/lib/challenge-intent'

// Middleware-Funktion, die die Supabase-Session synchronisiert und
// basierend auf Authentifizierung / Onboarding-Status weiterleitet.
export async function updateSession(request: NextRequest) {
  // Schnell prüfen, ob die Route öffentlich ist – wenn ja, kurzschließen
  // ohne Supabase-Client/Netzwerkaufrufe. Das vermeidet Latenz für die
  // Marketing-Seite und andere öffentliche Routen.
  const publicRoutes = ['/', '/login', '/auth/callback', '/api/waitlist']
  const isPublicRoute = publicRoutes.some(
    (route) => request.nextUrl.pathname === route
  )

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Initialisiere die Standard-Response, die am Ende zurückgegeben wird.
  // `NextResponse.next()` bedeutet: Anfrage normal weiterverarbeiten.
  let supabaseResponse = NextResponse.next({ request })

  // Erstelle einen Supabase-Server-Client für SSR (Server-Side Rendering).
  // Der Client bekommt benutzerdefinierte Cookie-Handler, damit Supabase
  // Cookies lesen und (bei Bedarf) setzen kann.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        // Liefert alle Cookies aus dem eingehenden Request an Supabase.
        getAll() {
          return request.cookies.getAll()
        },
        // Wenn Supabase Cookies setzen möchte, werden diese hier verarbeitet.
        // Wir setzen sie zuerst im Request (für nachfolgende Middleware/Logik)
        // und dann in der Response, damit sie an den Client geschickt wird.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          // Erstelle eine neue NextResponse (wichtig, damit cookies.set funktioniert)
          supabaseResponse = NextResponse.next({ request })
          // Setze die von Supabase gewünschten Cookies in der Response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Hole den aktuell angemeldeten Nutzer (falls vorhanden).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Falls kein Nutzer angemeldet ist und die Route nicht öffentlich ist,
  // leiten wir den Request zur Login-Seite weiter.
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Wenn ein Nutzer angemeldet ist, prüfen wir, ob das Onboarding
  // für das Profil abgeschlossen wurde — falls nicht, weiterleiten.
  if (user && !isPublicRoute && request.nextUrl.pathname !== '/onboarding') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single()

    // Falls das Profil existiert und `onboarding_complete` false ist,
    // leiten wir den Nutzer zur Onboarding-Seite weiter.
    if (profile && !profile.onboarding_complete) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // Jemand hat vor dem Signup auf einer Challenge-Landingpage „Start“
    // geklickt. Sobald Onboarding erledigt ist und das Dashboard geladen
    // wird, schicken wir ihn über die Join-Route, die die Challenge startet
    // und das Cookie löscht (siehe src/lib/challenge-intent.ts).
    const challengeIntent = readChallengeIntent(
      request.cookies.get(CHALLENGE_INTENT_COOKIE)?.value
    )
    if (challengeIntent && request.nextUrl.pathname === '/dashboard') {
      const url = request.nextUrl.clone()
      url.pathname = challengeJoinPath(challengeIntent)
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Gebe die (möglicherweise mit neuen Cookies versehene) Response zurück.
  return supabaseResponse
}

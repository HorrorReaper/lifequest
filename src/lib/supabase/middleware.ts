// src/lib/supabase/middleware.ts

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Middleware-Funktion, die die Supabase-Session synchronisiert und
// basierend auf Authentifizierung / Onboarding-Status weiterleitet.
export async function updateSession(request: NextRequest) {
  // Initialisiere die Standard-Response, die am Ende zurückgegeben wird.
  // `NextResponse.next()` bedeutet: Anfrage normal weiterverarbeiten.
  let supabaseResponse = NextResponse.next({ request })

  // Erstelle einen Supabase-Server-Client für SSR (Server-Side Rendering).
  // Der Client bekommt benutzerdefinierte Cookie-Handler, damit Supabase
  // Cookies lesen und (bei Bedarf) setzen kann.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Liefert alle Cookies aus dem eingehenden Request an Supabase.
        getAll() {
          return request.cookies.getAll()
        },
        // Wenn Supabase Cookies setzen möchte, werden diese hier verarbeitet.
        // Wir setzen sie zuerst im Request (für nachfolgende Middleware/Logik)
        // und dann in der Response, damit sie an den Client geschickt werden.
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

  // Liste mit öffentlichen Routen, für die keine Authentifizierung nötig ist.
  const publicRoutes = ['/', '/login', '/auth/callback']
  const isPublicRoute = publicRoutes.some(
    (route) => request.nextUrl.pathname === route
  )

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
  }

  // Gebe die (möglicherweise mit neuen Cookies versehene) Response zurück.
  return supabaseResponse
}

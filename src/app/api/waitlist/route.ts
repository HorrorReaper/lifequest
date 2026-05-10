import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, hp } = body || {}

    // simple honeypot
    if (hp) return NextResponse.json({ ok: true })

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 })
    }

    // TODO: persist to a DB or mailing provider. For now, log server-side.
    // This keeps the endpoint public and functional without requiring
    // additional secrets.
    console.log('Waitlist signup:', { email, name })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Waitlist error', err)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}

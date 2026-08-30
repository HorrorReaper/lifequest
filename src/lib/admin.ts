import 'server-only'
import { cookies } from 'next/headers'

/**
 * Set while an admin is previewing the app as an ordinary user.
 *
 * A session cookie on purpose: preview is a look-around, not a setting, and
 * closing the browser must always be enough to get back out of it even if the
 * exit control were somehow unreachable.
 */
export const PREVIEW_AS_USER_COOKIE = 'lifequest-preview-as-user'

interface AdminCandidate {
  id?: string | null
  email?: string | null
  app_metadata?: Record<string, unknown> | null
}

function parseAllowlist(value: string | undefined) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isAdminUser(user: AdminCandidate | null | undefined) {
  if (!user) return false

  if (hasTrustedAdminRole(user)) return true

  const adminEmails = parseAllowlist(process.env.ADMIN_EMAILS)
  const adminUserIds = parseAllowlist(process.env.ADMIN_USER_IDS)
  const email = user.email?.trim().toLowerCase()
  const id = user.id?.trim().toLowerCase()

  return Boolean(
    (email && adminEmails.has(email)) ||
      (id && adminUserIds.has(id))
  )
}

export function hasTrustedAdminRole(user: AdminCandidate | null | undefined) {
  return user?.app_metadata?.role === 'admin'
}

export function assertAdminUser(user: AdminCandidate | null | undefined) {
  if (!isAdminUser(user)) {
    throw new Error('Admin access required')
  }
}

/** True while the current request is running in "preview as a normal user" mode. */
export async function isPreviewingAsUser(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(PREVIEW_AS_USER_COOKIE)?.value === '1'
}

/**
 * Whether admin-only *interface* should be shown for this request.
 *
 * This is what every screen should ask, so an admin previewing the app sees
 * exactly what a normal user sees. It is deliberately not what the API routes,
 * RPCs, or RLS policies ask: preview only ever takes privileges away, never
 * grants them, so it is a view filter and must not be mistaken for an
 * authorization boundary. The real boundary stays where it already is.
 */
export async function showAdminUi(user: AdminCandidate | null | undefined): Promise<boolean> {
  if (!isAdminUser(user)) return false
  return !(await isPreviewingAsUser())
}

import 'server-only'

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

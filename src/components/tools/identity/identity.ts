import type { ToolEntry } from '@/lib/tools/storage'

export const IDENTITY_TOOL_ID = 'identity'

/** "I am someone who ..." lines; three is the sweet spot, five the most. */
export const MAX_IDENTITY_STATEMENTS = 5
export const MAX_STATEMENT_LENGTH = 200
export const MAX_PROOF_LENGTH = 500

export interface IdentityPayload {
  statements: string[]
  /** One small thing that person would do today: identity is built by proof. */
  dailyProof: string
}

export function isIdentityPayload(value: unknown): value is IdentityPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<IdentityPayload>
  return (
    Array.isArray(candidate.statements) &&
    candidate.statements.length > 0 &&
    candidate.statements.every((statement) => typeof statement === 'string') &&
    typeof candidate.dailyProof === 'string'
  )
}

/** Newest first, like Vision: each save is a revision, so the shift stays visible. */
export function toIdentityRevisions(entries: ToolEntry[]): ToolEntry<IdentityPayload>[] {
  return entries.filter((entry): entry is ToolEntry<IdentityPayload> => isIdentityPayload(entry.payload))
}

/** Trimmed, non-empty statements, capped; null when nothing worth saving is left. */
export function cleanIdentity(statements: string[], dailyProof: string): IdentityPayload | null {
  const cleaned = statements
    .map((statement) => statement.trim().slice(0, MAX_STATEMENT_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_IDENTITY_STATEMENTS)
  if (cleaned.length === 0) return null
  return { statements: cleaned, dailyProof: dailyProof.trim().slice(0, MAX_PROOF_LENGTH) }
}

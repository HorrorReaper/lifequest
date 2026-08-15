import type { ReactNode } from 'react'

import type { ChecklistItem, DayPlanBlock, FieldValue, TemplateField } from '@/lib/types'

export const DISPLAY_ONLY_JOURNAL_FIELD_TYPES = ['divider', 'heading', 'prompt'] as const

const DRAFT_VERSION = 1
// Kept in sync with InsightType (src/lib/types.ts) by hand — this Set exists
// only to validate a deserialized sessionStorage draft, so TypeScript can't
// catch a missed value here the way it does for the `satisfies Record<InsightType, ...>`
// icon/style maps elsewhere. A value missing from this Set doesn't error, it
// silently fails validation and the whole draft gets discarded on restore.
const INSIGHT_TYPES = new Set(['learning', 'problem', 'idea', 'decision', 'win'])

export interface MobileJournalStep {
  id: string
  fields: TemplateField[]
  answerField: TemplateField | null
}

export interface JournalDraft {
  activeStep: number
  values: Record<string, FieldValue>
}

export interface MobileJournalStepAdvance {
  nextStep: number
  blockedFieldId: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key)
}

export function isDisplayOnlyJournalField(field: TemplateField) {
  return (DISPLAY_ONLY_JOURNAL_FIELD_TYPES as readonly string[]).includes(field.field_type)
}

export function buildMobileJournalSteps(fields: TemplateField[]): MobileJournalStep[] {
  const steps: MobileJournalStep[] = []
  let leadingDisplayFields: TemplateField[] = []

  for (const field of fields) {
    if (isDisplayOnlyJournalField(field)) {
      leadingDisplayFields.push(field)
      continue
    }

    steps.push({
      id: field.id,
      fields: [...leadingDisplayFields, field],
      answerField: field,
    })
    leadingDisplayFields = []
  }

  if (leadingDisplayFields.length > 0) {
    const finalStep = steps.at(-1)

    if (finalStep) {
      finalStep.fields.push(...leadingDisplayFields)
    } else {
      steps.push({
        id: leadingDisplayFields[0].id,
        fields: leadingDisplayFields,
        answerField: null,
      })
    }
  }

  return steps
}

export function isJournalFieldComplete(
  field: TemplateField,
  value: FieldValue | undefined
) {
  if (isDisplayOnlyJournalField(field)) return true
  if (!value) return false

  switch (field.field_type) {
    case 'text':
    case 'textarea':
    case 'select':
    case 'mood':
      return Boolean(value.value_text?.trim())
    case 'number':
    case 'slider':
    case 'rating':
      return value.value_number !== null && value.value_number !== undefined
    case 'checkbox':
      return Boolean(value.value_boolean)
    case 'checklist':
      return Boolean(
        Array.isArray(value.value_json) &&
          (value.value_json as ChecklistItem[]).some((item) => item.checked)
      )
    case 'tasks':
      return Boolean(
        Array.isArray(value.value_json) &&
          value.value_json.some(
            (task) => isRecord(task) && typeof task.title === 'string' && task.title.trim()
          )
      )
    case 'day_planner':
      return Boolean(
        isRecord(value.value_json) &&
          Array.isArray(value.value_json.blocks) &&
          (value.value_json.blocks as DayPlanBlock[]).length > 0
      )
    case 'habit_tracker':
      return Array.isArray(value.value_json) && value.value_json.length > 0
    case 'learning':
      return Boolean(
        isRecord(value.value_json) &&
          typeof value.value_json.title === 'string' &&
          value.value_json.title.trim() &&
          typeof value.value_json.note === 'string' &&
          value.value_json.note.trim()
      )
    default:
      return false
  }
}

export function advanceMobileJournalStep({
  activeStep,
  steps,
  values,
}: {
  activeStep: number
  steps: MobileJournalStep[]
  values: Record<string, FieldValue>
}): MobileJournalStepAdvance {
  const currentStep = steps[activeStep]
  const answerField = currentStep?.answerField

  if (
    answerField?.is_required &&
    !isJournalFieldComplete(answerField, values[answerField.id])
  ) {
    return {
      nextStep: activeStep,
      blockedFieldId: answerField.id,
    }
  }

  return {
    nextStep: Math.min(activeStep + 1, Math.max(steps.length - 1, 0)),
    blockedFieldId: null,
  }
}

function isValidDraftValue(value: unknown, fieldId: string): value is FieldValue {
  if (!isRecord(value) || value.field_id !== fieldId) return false

  if (
    hasOwn(value, 'value_text') &&
    value.value_text !== null &&
    typeof value.value_text !== 'string'
  ) {
    return false
  }

  if (
    hasOwn(value, 'value_number') &&
    value.value_number !== null &&
    (typeof value.value_number !== 'number' || !Number.isFinite(value.value_number))
  ) {
    return false
  }

  if (
    hasOwn(value, 'value_boolean') &&
    value.value_boolean !== null &&
    typeof value.value_boolean !== 'boolean'
  ) {
    return false
  }

  if (
    hasOwn(value, 'insight_type') &&
    value.insight_type !== null &&
    (typeof value.insight_type !== 'string' || !INSIGHT_TYPES.has(value.insight_type))
  ) {
    return false
  }

  if (
    hasOwn(value, 'topic_tags') &&
    (!Array.isArray(value.topic_tags) ||
      !value.topic_tags.every((tag) => typeof tag === 'string'))
  ) {
    return false
  }

  if (
    hasOwn(value, 'insight_marked_at') &&
    value.insight_marked_at !== null &&
    typeof value.insight_marked_at !== 'string'
  ) {
    return false
  }

  if (
    hasOwn(value, 'insight_is_favorite') &&
    typeof value.insight_is_favorite !== 'boolean'
  ) {
    return false
  }

  return true
}

export function journalDraftKey({
  userId,
  templateId,
  existingEntryId,
}: {
  userId: string
  templateId: string
  existingEntryId?: string
}) {
  const target = existingEntryId ? `entry:${existingEntryId}` : `template:${templateId}:new`
  return `lifequest:journal-draft:v${DRAFT_VERSION}:${encodeURIComponent(userId)}:${encodeURIComponent(target)}`
}

export function serializeJournalDraft(draft: JournalDraft) {
  return JSON.stringify({
    version: DRAFT_VERSION,
    activeStep: draft.activeStep,
    values: draft.values,
  })
}

export function removeStoredJournalDraft(
  storage: Pick<Storage, 'removeItem'>,
  storageKey: string
) {
  storage.removeItem(storageKey)
}

export function restoreJournalDraft(
  rawDraft: string | null,
  fields: TemplateField[],
  stepCount: number
): JournalDraft | null {
  if (!rawDraft) return null

  let parsed: unknown

  try {
    parsed = JSON.parse(rawDraft)
  } catch {
    return null
  }

  if (
    !isRecord(parsed) ||
    parsed.version !== DRAFT_VERSION ||
    !Number.isInteger(parsed.activeStep) ||
    (parsed.activeStep as number) < 0 ||
    !isRecord(parsed.values)
  ) {
    return null
  }

  const knownFields = new Map(
    fields
      .filter((field) => !isDisplayOnlyJournalField(field))
      .map((field) => [field.id, field])
  )
  const values: Record<string, FieldValue> = {}

  for (const [fieldId, value] of Object.entries(parsed.values)) {
    if (!knownFields.has(fieldId)) continue
    if (!isValidDraftValue(value, fieldId)) return null
    values[fieldId] = value
  }

  return {
    activeStep:
      stepCount > 0 ? Math.min(parsed.activeStep as number, stepCount - 1) : 0,
    values,
  }
}

export function MobileJournalStepPanel({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  return (
    <section
      className={`${active ? 'block' : 'hidden'} space-y-4 md:block`}
      data-active={active ? 'true' : 'false'}
    >
      {children}
    </section>
  )
}

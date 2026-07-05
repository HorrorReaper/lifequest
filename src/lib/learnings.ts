export interface LearningDraft {
  title: string
  note: string
  tags: string[]
  action_text: string | null
}

export type LearningFieldValue = LearningDraft

export function normalizeLearningTags(value: string | string[]): string[] {
  const tags = Array.isArray(value) ? value : value.split(',')

  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
        .filter(Boolean)
        .slice(0, 8)
    ),
  ]
}

export function cleanLearningDraft(draft: LearningDraft): LearningDraft {
  return {
    title: draft.title.trim().replace(/\s+/g, ' ').slice(0, 120),
    note: draft.note.trim().replace(/\s+/g, ' ').slice(0, 1200),
    tags: normalizeLearningTags(draft.tags).slice(0, 5),
    action_text: draft.action_text?.trim().replace(/\s+/g, ' ').slice(0, 500) || null,
  }
}

export function isValidLearningDraft(draft: LearningDraft): boolean {
  const cleaned = cleanLearningDraft(draft)
  return cleaned.title.length > 0 && cleaned.note.length > 0
}

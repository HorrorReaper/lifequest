import type { MoodOption } from '@/lib/types'

// Single source of truth for the mood vocabulary so the journal's mood field
// and the Today Plan mood check-in stay the same five options — the app
// should feel like one system, not two separate mood pickers that happen to
// look similar.
export const DEFAULT_MOOD_OPTIONS: MoodOption[] = [
  { value: 'great', emoji: '😊' },
  { value: 'good', emoji: '🙂' },
  { value: 'okay', emoji: '😐' },
  { value: 'low', emoji: '😔' },
  { value: 'struggling', emoji: '😢' },
]

export const MOOD_VALUES = DEFAULT_MOOD_OPTIONS.map((option) => option.value)

export function isValidMoodValue(value: unknown): value is string {
  return typeof value === 'string' && MOOD_VALUES.includes(value)
}

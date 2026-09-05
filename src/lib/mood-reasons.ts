export interface MoodReasonOption {
  id: string;
  label: string;
  emoji: string;
}

/**
 * What people name when asked why a day feels the way it does.
 *
 * Deliberately not SKILL_CATEGORIES: those exist to bucket earned XP, so
 * they carry "Focus" and "Career" but no family and no adventure, and asking
 * someone to explain a mood in an XP taxonomy gets the wrong answer. Plain
 * words on purpose -- a reason is something you recognise, not something you
 * have to decode.
 */
export const MOOD_REASONS: MoodReasonOption[] = [
  { id: "fitness", label: "Fitness", emoji: "💪" },
  { id: "family", label: "Family", emoji: "🏡" },
  { id: "friends", label: "Friends", emoji: "🤝" },
  { id: "adventure", label: "Adventure", emoji: "🧭" },
  { id: "work", label: "Work", emoji: "💼" },
  { id: "rest", label: "Rest", emoji: "😴" },
  { id: "health", label: "Health", emoji: "🩺" },
  { id: "learning", label: "Learning", emoji: "📚" },
  { id: "money", label: "Money", emoji: "💰" },
  { id: "creativity", label: "Creativity", emoji: "🎨" },
];

export const MOOD_REASON_IDS = MOOD_REASONS.map((reason) => reason.id);

/** How long a self-written reason may be. */
export const MOOD_REASON_NOTE_MAX = 120;

export function isValidMoodReason(value: unknown): value is string {
  return typeof value === "string" && MOOD_REASON_IDS.includes(value);
}

/**
 * Keeps only reasons this app knows, in the order the vocabulary lists them.
 *
 * Stored plans outlive the list they were written against, so an id that has
 * since been removed is dropped rather than rendered as a blank chip.
 */
export function normalizeMoodReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const chosen = new Set(value.filter(isValidMoodReason));
  return MOOD_REASON_IDS.filter((id) => chosen.has(id));
}

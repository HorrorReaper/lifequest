
export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  total_xp: number
  current_streak: number
  best_streak: number
  streak_freezes: number
  last_journal_date: string | null
  timezone: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
} // Typ für ein Nutzerprofil

export interface JournalTemplate {
  id: string
  user_id: string | null
  name: string
  description: string | null
  entry_type: string
  icon: string
  is_default: boolean
  is_system: boolean
  xp_reward: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
} // Template für ein Journal

export interface TemplateField {
  id: string
  template_id: string
  field_type: FieldType
  label: string
  description: string | null
  placeholder: string | null
  is_required: boolean
  sort_order: number
  config: Record<string, unknown>
  created_at: string
} //Template Feld

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'select'
  | 'mood'
  | 'rating'
  | 'checkbox'
  | 'checklist'
  | 'divider'
  | 'heading'
  | 'prompt'
//Die verschiedenen Arten von Template-Feldern
export interface FieldValue {
  field_id: string
  value_text?: string | null
  value_number?: number | null
  value_boolean?: boolean | null
  value_json?: unknown | null
} //Wert, den ein Feld annehmen kann

export interface JournalEntry {
  id: string
  user_id: string
  template_id: string
  entry_date: string
  is_complete: boolean
  xp_earned: number
  created_at: string
  updated_at: string
  journal_templates?: JournalTemplate //welches Template wurde verwendet
  journal_responses?: JournalResponse[] //wie sind die Antworten für das Template
} //Eintrag in ein Journal

export interface JournalResponse {
  id: string
  entry_id: string
  field_id: string
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_json: unknown | null
  template_fields?: TemplateField
} //Antwort auf ein Journal

export interface MoodOption {
  value: string
  emoji: string
}

export interface ChecklistItem {
  label: string
  checked: boolean
}
// ============================================
// CITY BUILDER TYPES
// ============================================

export type CityTier = 'village' | 'town' | 'city' | 'metropolis' | 'capital';
export type UnlockType = 'level' | 'streak' | 'entries_count' | 'entry_types';

export interface CityBuilding {
  id: string;
  name: string;
  emoji: string;
  description: string;
  city_tier: CityTier;
  unlock_type: UnlockType;
  unlock_value: number;
  sort_order: number;
  image_url: string | null;
  created_at: string;
}

export interface UserBuilding {
  id: string;
  user_id: string;
  building_id: string;
  unlocked_at: string;
}

export interface CityBuildingWithStatus extends CityBuilding {
  is_unlocked: boolean;
  unlocked_at: string | null;
  is_newly_unlocked?: boolean;
}

export interface PlayerStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  uniqueTemplatesUsed: number;
}


export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          total_xp?: number
          current_streak?: number
          best_streak?: number
          streak_freezes?: number
          last_journal_date?: string | null
          timezone?: string
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          total_xp?: number
          current_streak?: number
          best_streak?: number
          streak_freezes?: number
          last_journal_date?: string | null
          timezone?: string
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      journal_templates: {
        Row: {
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
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          description?: string | null
          entry_type?: string
          icon?: string
          is_default?: boolean
          is_system?: boolean
          xp_reward?: number
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          description?: string | null
          entry_type?: string
          icon?: string
          is_default?: boolean
          is_system?: boolean
          xp_reward?: number
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      template_fields: {
        Row: {
          id: string
          template_id: string
          field_type: string
          label: string
          description: string | null
          placeholder: string | null
          is_required: boolean
          sort_order: number
          config: Json
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          field_type: string
          label: string
          description?: string | null
          placeholder?: string | null
          is_required?: boolean
          sort_order?: number
          config?: Json
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          field_type?: string
          label?: string
          description?: string | null
          placeholder?: string | null
          is_required?: boolean
          sort_order?: number
          config?: Json
          created_at?: string
        }
      }
      journal_entries: {
        Row: {
          id: string
          user_id: string
          template_id: string
          entry_date: string
          is_complete: boolean
          xp_earned: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          entry_date?: string
          is_complete?: boolean
          xp_earned?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          entry_date?: string
          is_complete?: boolean
          xp_earned?: number
          created_at?: string
          updated_at?: string
        }
      }
      journal_responses: {
        Row: {
          id: string
          entry_id: string
          field_id: string
          value_text: string | null
          value_number: number | null
          value_boolean: boolean | null
          value_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          entry_id: string
          field_id: string
          value_text?: string | null
          value_number?: number | null
          value_boolean?: boolean | null
          value_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          entry_id?: string
          field_id?: string
          value_text?: string | null
          value_number?: number | null
          value_boolean?: boolean | null
          value_json?: Json | null
          created_at?: string
        }
      }
      journal_prompts: {
        Row: {
          id: string
          entry_type: string
          prompt_text: string
          category: string
          is_active: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          entry_type: string
          prompt_text: string
          category: string
          is_active?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          entry_type?: string
          prompt_text?: string
          category?: string
          is_active?: boolean
          sort_order?: number
        }
      }
      xp_events: {
        Row: {
          id: string
          user_id: string
          source_type: string
          source_id: string | null
          xp_amount: number
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_type: string
          source_id?: string | null
          xp_amount: number
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_type?: string
          source_id?: string | null
          xp_amount?: number
          description?: string
          created_at?: string
        }
      }
      city_buildings: {
        Row: {
          id: string
          name: string
          emoji: string
          description: string
          city_tier: string
          unlock_type: string
          unlock_value: number
          sort_order: number
          image_url: string | null
        }
        Insert: {
          id?: string
          name: string
          emoji: string
          description: string
          city_tier: string
          unlock_type: string
          unlock_value: number
          sort_order?: number
          image_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          emoji?: string
          description?: string
          city_tier?: string
          unlock_type?: string
          unlock_value?: number
          sort_order?: number
          image_url?: string | null
        }
      }
      user_buildings: {
        Row: {
          id: string
          user_id: string
          building_id: string
          unlocked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          building_id: string
          unlocked_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          building_id?: string
          unlocked_at?: string
        }
      }
      streak_history: {
        Row: {
          id: string
          user_id: string
          streak_length: number
          started_on: string
          ended_on: string
          used_freeze: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          streak_length: number
          started_on: string
          ended_on: string
          used_freeze?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          streak_length?: number
          started_on?: string
          ended_on?: string
          used_freeze?: boolean
          created_at?: string
        }
      }
    }
    Functions: {
      get_level: {
        Args: { xp: number }
        Returns: number
      }
      get_city_tier: {
        Args: { level: number }
        Returns: string
      }
      xp_to_next_level: {
        Args: { xp: number }
        Returns: number
      }
    }
  }
}

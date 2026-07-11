import { CityBuilding, UserBuilding } from "../types"

export type ProductivityPriorityRow = { id: string; user_id: string; priority_date: string; task_id: string; sort_order: number; created_at: string }
export type FocusSessionRow = { id: string; user_id: string; task_id: string | null; planned_minutes: number; status: 'active' | 'completed' | 'cancelled'; started_at: string; ended_at: string | null; actual_seconds: number | null; created_at: string; updated_at: string }
export type ExerciseRow = { id: string; user_id: string; name: string; muscle_group: string; equipment: string; notes: string | null; is_archived: boolean; created_at: string; updated_at: string }
export type WorkoutTemplateRow = { id: string; user_id: string; name: string; notes: string | null; sort_order: number; created_at: string; updated_at: string }
export type WorkoutTemplateExerciseRow = { id: string; template_id: string; exercise_id: string; sort_order: number; target_sets: number; rep_min: number | null; rep_max: number | null; rest_seconds: number; created_at: string }
export type WorkoutSessionRow = { id: string; user_id: string; template_id: string | null; name: string; status: 'active' | 'completed' | 'cancelled'; started_at: string; ended_at: string | null; duration_seconds: number | null; notes: string | null; created_at: string; updated_at: string }
export type WorkoutSessionExerciseRow = { id: string; session_id: string; exercise_id: string; sort_order: number; is_complete: boolean; created_at: string }
export type WorkoutSetRow = { id: string; session_exercise_id: string; set_order: number; set_type: 'warmup' | 'working' | 'drop' | 'failure'; reps: number | null; weight_kg: number | null; rir: number | null; is_complete: boolean; completed_at: string | null; created_at: string; updated_at: string }
export type NutritionTargetRow = { user_id: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; created_at: string; updated_at: string }
export type NutritionEntryRow = { id: string; user_id: string; entry_date: string; meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; notes: string | null; created_at: string; updated_at: string }
export type QuestDailyLogRow = { id: string; quest_id: string; user_id: string; log_date: string; note: string | null; created_at: string }
export type ChallengeTemplateRow = { id: string; created_by: string; title: string; description: string | null; duration_days: number; schedule_mode: 'sequential' | 'strict'; xp_reward: number; coin_reward: number; is_published: boolean; created_at: string; updated_at: string }
export type ChallengeDayRow = { id: string; template_id: string; day_number: number; title: string; instructions: string; reflection_prompt: string | null; created_at: string }
export type ChallengeEnrollmentRow = { id: string; template_id: string; user_id: string; start_date: string; status: 'active' | 'completed' | 'failed' | 'abandoned'; completed_at: string | null; created_at: string; updated_at: string }
export type ChallengeDayProgressRow = { id: string; enrollment_id: string; challenge_day_id: string; user_id: string; day_number: number; completed_on: string; note: string | null; created_at: string }
export type AdminNoteRow = { id: string; user_id: string; title: string; body: string; tags: string[]; module: 'general' | 'productivity' | 'workouts' | 'nutrition' | 'challenges' | 'tools'; status: 'idea' | 'testing' | 'validated' | 'rejected'; is_pinned: boolean; created_at: string; updated_at: string }

type MutableTable<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

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
      journal_learnings: {
        Row: {
          id: string
          user_id: string
          entry_id: string
          field_id: string | null
          title: string
          note: string
          tags: string[]
          source_response_ids: string[]
          action_text: string | null
          is_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entry_id: string
          field_id?: string | null
          title: string
          note: string
          tags?: string[]
          source_response_ids?: string[]
          action_text?: string | null
          is_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entry_id?: string
          field_id?: string | null
          title?: string
          note?: string
          tags?: string[]
          source_response_ids?: string[]
          action_text?: string | null
          is_favorite?: boolean
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
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string
          color: string
          is_archived: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string
          color?: string
          is_archived?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          emoji?: string
          color?: string
          is_archived?: boolean
          sort_order?: number
          created_at?: string
        }
      }
      habit_logs: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          entry_id: string | null
          log_date: string
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          habit_id: string
          entry_id?: string | null
          log_date: string
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          entry_id?: string | null
          log_date?: string
          completed?: boolean
          created_at?: string
        }
      }
      routines: {
        Row: {
          id: string
          user_id: string
          name: string
          emoji: string
          description: string | null
          is_archived: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          emoji?: string
          description?: string | null
          is_archived?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          emoji?: string
          description?: string | null
          is_archived?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      routine_items: {
        Row: {
          id: string
          routine_id: string
          habit_id: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          routine_id: string
          habit_id: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          routine_id?: string
          habit_id?: string
          sort_order?: number
          created_at?: string
        }
      }
      productivity_daily_priorities: MutableTable<ProductivityPriorityRow, 'user_id' | 'priority_date' | 'task_id'>
      focus_sessions: MutableTable<FocusSessionRow, 'user_id' | 'planned_minutes'>
      exercises: MutableTable<ExerciseRow, 'user_id' | 'name'>
      workout_templates: MutableTable<WorkoutTemplateRow, 'user_id' | 'name'>
      workout_template_exercises: MutableTable<WorkoutTemplateExerciseRow, 'template_id' | 'exercise_id'>
      workout_sessions: MutableTable<WorkoutSessionRow, 'user_id' | 'name'>
      workout_session_exercises: MutableTable<WorkoutSessionExerciseRow, 'session_id' | 'exercise_id'>
      workout_sets: MutableTable<WorkoutSetRow, 'session_exercise_id'>
      nutrition_targets: MutableTable<NutritionTargetRow, 'user_id'>
      nutrition_entries: MutableTable<NutritionEntryRow, 'user_id' | 'entry_date' | 'name'>
      challenge_templates: MutableTable<ChallengeTemplateRow, 'created_by' | 'title' | 'duration_days'>
      challenge_days: MutableTable<ChallengeDayRow, 'template_id' | 'day_number' | 'title' | 'instructions'>
      challenge_enrollments: MutableTable<ChallengeEnrollmentRow, 'template_id' | 'user_id' | 'start_date'>
      challenge_day_progress: MutableTable<ChallengeDayProgressRow, 'enrollment_id' | 'challenge_day_id' | 'user_id' | 'day_number' | 'completed_on'>
      admin_notes: MutableTable<AdminNoteRow, 'user_id' | 'title'>
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
        /*Row: {
          id: string
          name: string
          emoji: string
          description: string
          city_tier: string
          unlock_type: string
          unlock_value: number
          sort_order: number
          image_url: string | null
        }*/
       Row: CityBuilding;
        /*Insert: {
          id?: string
          name: string
          emoji: string
          description: string
          city_tier: string
          unlock_type: string
          unlock_value: number
          sort_order?: number
          image_url?: string | null
        }*/
        Insert: Omit<CityBuilding, "id" | "created_at"> & { id?: string; created_at?: string };
        /*Update: {
          id?: string
          name?: string
          emoji?: string
          description?: string
          city_tier?: string
          unlock_type?: string
          unlock_value?: number
          sort_order?: number
          image_url?: string | null
        }*/
        Update: never; //CityBuilding is static data, we won't update it through the app
      }
      user_buildings: {
        Row: UserBuilding;
        Insert: Omit<UserBuilding, 'id' | 'unlocked_at'> & { id?: string; unlocked_at?: string };
        Update: never;
      },
      waitlist_signups: {
        Row: {
          id: string
          email: string
          name: string | null
          source: string
          interested_pro: boolean
          early_access: boolean
          newsletter: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          source?: string
          interested_pro?: boolean
          early_access?: boolean
          newsletter?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          source?: string
          interested_pro?: boolean
          early_access?: boolean
          newsletter?: boolean
          created_at?: string
        }
      },
      city_states: {
        Row: {
          id: string
          user_id: string
          coins: number
          xp: number
          level: number
          claimed_entry_ids: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          coins?: number
          xp?: number
          level?: number
          claimed_entry_ids?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          coins?: number
          xp?: number
          level?: number
          claimed_entry_ids?: string[] | null
          created_at?: string
          updated_at?: string
        }
      },
      city_buildings_placing: {
        Row: {
          id: string
          user_id: string
          building_type: string
          row: number
          col: number
          placed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          building_type: string
          row?: number
          col?: number
          placed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          building_type?: string
          row?: number
          col?: number
          placed_at?: string
        }
      },
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
      quests: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          xp_reward: number
          coin_reward: number
          quest_type: 'single' | 'daily_challenge'
          challenge_days: number | null
          challenge_task: string | null
          challenge_start_date: string | null
          is_completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          xp_reward?: number
          coin_reward?: number
          quest_type?: 'single' | 'daily_challenge'
          challenge_days?: number | null
          challenge_task?: string | null
          challenge_start_date?: string | null
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          xp_reward?: number
          coin_reward?: number
          quest_type?: 'single' | 'daily_challenge'
          challenge_days?: number | null
          challenge_task?: string | null
          challenge_start_date?: string | null
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          why: string | null
          category: 'personal' | 'health' | 'career' | 'relationships' | 'learning' | 'finance' | 'other'
          target_date: string | null
          status: 'active' | 'completed' | 'archived'
          sort_order: number
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          why?: string | null
          category?: 'personal' | 'health' | 'career' | 'relationships' | 'learning' | 'finance' | 'other'
          target_date?: string | null
          status?: 'active' | 'completed' | 'archived'
          sort_order?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          why?: string | null
          category?: 'personal' | 'health' | 'career' | 'relationships' | 'learning' | 'finance' | 'other'
          target_date?: string | null
          status?: 'active' | 'completed' | 'archived'
          sort_order?: number
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quest_daily_logs: MutableTable<QuestDailyLogRow, 'quest_id' | 'user_id' | 'log_date'>
      quest_completions: {
        Row: {
          id: string
          user_id: string
          quest_key: string
          completed_at: string
          xp_awarded: number
          coins_awarded: number
        }
        Insert: {
          id?: string
          user_id: string
          quest_key: string
          completed_at?: string
          xp_awarded: number
          coins_awarded: number
        }
        Update: {
          id?: string
          user_id?: string
          quest_key?: string
          completed_at?: string
          xp_awarded?: number
          coins_awarded?: number
        }
      }
      lesson_completions: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed_at: string
          xp_awarded: number
          coins_awarded: number
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed_at?: string
          xp_awarded: number
          coins_awarded: number
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed_at?: string
          xp_awarded?: number
          coins_awarded?: number
        }
      }
    }
    Functions: {
      admin_app_stats: {
        Args: Record<PropertyKey, never>
        Returns: { total_users: number }[]
      }
      check_in_daily_challenge_quest: {
        Args: { p_quest_id: string; p_note?: string | null }
        Returns: { log_date: string; completed_days: number; required_days: number; ready_to_complete: boolean }[]
      }
      admin_save_challenge_template: {
        Args: { p_template_id: string | null; p_title: string; p_description: string; p_schedule_mode: 'sequential' | 'strict'; p_xp_reward: number; p_coin_reward: number; p_is_published: boolean; p_days: Json }
        Returns: string
      }
      start_challenge_program: {
        Args: { p_template_id: string }
        Returns: { enrollment_id: string; start_date: string; status: string }[]
      }
      restart_challenge_program: {
        Args: { p_template_id: string }
        Returns: { enrollment_id: string; start_date: string; status: string }[]
      }
      complete_challenge_program_day: {
        Args: { p_enrollment_id: string; p_note?: string | null }
        Returns: { completed_day: number; completed_days: number; total_days: number; completion_date: string; challenge_completed: boolean; total_xp: number; coins: number }[]
      }
      claim_system_quest_reward: {
        Args: { p_quest_key: string }
        Returns: { total_xp: number; coins: number }[]
      }
      complete_custom_quest_reward: {
        Args: { p_quest_id: string }
        Returns: { total_xp: number; coins: number }[]
      }
      complete_lesson_reward: {
        Args: { p_lesson_id: string }
        Returns: { total_xp: number; coins: number }[]
      }
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

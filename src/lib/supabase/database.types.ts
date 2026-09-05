import { CityBuilding, UserBuilding } from "../types"

export type ProductivityPriorityRow = { id: string; user_id: string; priority_date: string; task_id: string; sort_order: number; created_at: string }
export type FocusSessionRow = { id: string; user_id: string; task_id: string | null; planned_minutes: number; status: 'active' | 'completed' | 'cancelled'; started_at: string; ended_at: string | null; actual_seconds: number | null; created_at: string; updated_at: string }
export type ExerciseTrackingType = 'weight_reps' | 'bodyweight_reps' | 'assisted_reps' | 'duration' | 'distance_duration' | 'weight_duration'
export type ExerciseRow = { id: string; user_id: string | null; name: string; slug: string; muscle_group: string; target_muscle: string | null; secondary_muscles: string[]; equipment: string; tracking_type: ExerciseTrackingType; instructions: string[]; aliases: string[]; notes: string | null; is_archived: boolean; is_system: boolean; source: 'system' | 'custom'; catalog_source: string | null; catalog_external_id: string | null; source_version: string | null; source_url: string | null; attribution: string | null; created_at: string; updated_at: string }
export type WorkoutTemplateRow = { id: string; user_id: string; name: string; notes: string | null; sort_order: number; created_at: string; updated_at: string }
export type WorkoutTemplateExerciseRow = { id: string; template_id: string; exercise_id: string; sort_order: number; target_sets: number; rep_min: number | null; rep_max: number | null; rest_seconds: number; superset_group: string | null; notes: string | null; created_at: string }
export type WorkoutTemplateSetRow = { id: string; template_exercise_id: string; set_order: number; set_type: WorkoutSetType; target_reps: number | null; target_weight_kg: number | null; target_assistance_kg: number | null; target_duration_seconds: number | null; target_distance_meters: number | null; target_rir: number | null; created_at: string }
export type WorkoutSessionRow = { id: string; user_id: string; template_id: string | null; name: string; status: 'active' | 'completed' | 'cancelled'; started_at: string; ended_at: string | null; duration_seconds: number | null; notes: string | null; created_at: string; updated_at: string }
export type WorkoutSessionExerciseRow = { id: string; session_id: string; exercise_id: string; sort_order: number; is_complete: boolean; superset_group: string | null; rest_seconds: number | null; notes: string | null; created_at: string }
export type WorkoutSetType = 'warmup' | 'working' | 'drop' | 'failure'
export type WorkoutSetRow = { id: string; session_exercise_id: string; set_order: number; set_type: WorkoutSetType; reps: number | null; weight_kg: number | null; assistance_kg: number | null; duration_seconds: number | null; distance_meters: number | null; rir: number | null; is_complete: boolean; completed_at: string | null; created_at: string; updated_at: string }
export type WorkoutPreferenceRow = { user_id: string; default_rest_seconds: number; previous_scope: 'same_template' | 'any_workout'; weight_unit: 'kg'; distance_unit: 'km'; timer_sound: boolean; timer_vibration: boolean; created_at: string; updated_at: string }
export type ExercisePreferenceRow = { user_id: string; exercise_id: string; is_favorite: boolean; rest_seconds: number | null; created_at: string; updated_at: string }
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other'
export type NutritionTargetRow = { user_id: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null; sodium_mg: number | null; created_at: string; updated_at: string }
export type FoodItemRow = { id: string; user_id: string; source: 'custom' | 'usda' | 'open_food_facts'; external_id: string | null; barcode: string | null; name: string; brand: string | null; calories_per_100g: number; protein_per_100g: number; carbs_per_100g: number; fat_per_100g: number; fiber_per_100g: number; sugar_per_100g: number; sodium_mg_per_100g: number; default_serving_grams: number; default_serving_label: string; source_updated_at: string | null; is_archived: boolean; created_at: string; updated_at: string }
export type FoodPortionRow = { id: string; food_item_id: string; label: string; grams: number; is_default: boolean; created_at: string }
export type FoodFavoriteRow = { user_id: string; food_item_id: string; created_at: string }
export type SavedMealRow = { id: string; user_id: string; name: string; notes: string | null; created_at: string; updated_at: string }
export type SavedMealItemRow = { id: string; saved_meal_id: string; food_item_id: string; serving_grams: number; sort_order: number; created_at: string }
export type RecipeRow = { id: string; user_id: string; name: string; servings: number; yield_weight_g: number | null; notes: string | null; created_at: string; updated_at: string }
export type RecipeIngredientRow = { id: string; recipe_id: string; food_item_id: string; grams: number; sort_order: number; created_at: string }
export type NutritionEntryRow = { id: string; user_id: string; entry_date: string; meal_type: MealType; name: string; entry_kind: 'food' | 'quick_add' | 'saved_meal' | 'recipe'; food_item_id: string | null; serving_grams: number | null; serving_count: number; serving_label: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; sugar_g: number; sodium_mg: number; source_id: string | null; source_details: Json; notes: string | null; created_at: string; updated_at: string }
export type QuestDailyLogRow = { id: string; quest_id: string; user_id: string; log_date: string; note: string | null; created_at: string }
export type ChallengeTemplateRow = { id: string; created_by: string; title: string; description: string | null; duration_days: number; schedule_mode: 'sequential' | 'strict'; xp_reward: number; coin_reward: number; is_published: boolean; created_at: string; updated_at: string }
export type ChallengeDayRow = { id: string; template_id: string; day_number: number; title: string; instructions: string; reflection_prompt: string | null; created_at: string }
export type ChallengeEnrollmentRow = { id: string; template_id: string; user_id: string; start_date: string; status: 'active' | 'completed' | 'failed' | 'abandoned'; completed_at: string | null; created_at: string; updated_at: string }
export type ChallengeDayProgressRow = { id: string; enrollment_id: string; challenge_day_id: string; user_id: string; day_number: number; completed_on: string; note: string | null; created_at: string }
export type AdminNoteRow = { id: string; user_id: string; title: string; body: string; tags: string[]; module: 'general' | 'productivity' | 'workouts' | 'nutrition' | 'challenges' | 'tools'; status: 'idea' | 'testing' | 'validated' | 'rejected'; is_pinned: boolean; created_at: string; updated_at: string }
export type KnowledgeNoteType = 'note' | 'experiment' | 'meeting' | 'reference' | 'project'
export type KnowledgeFolderRow = { id: string; user_id: string; parent_id: string | null; name: string; sort_order: number; created_at: string; updated_at: string }
export type KnowledgeNoteRow = { id: string; user_id: string; folder_id: string | null; title: string; slug: string; content: string; note_type: KnowledgeNoteType; properties: Json; tags: string[]; aliases: string[]; is_pinned: boolean; is_archived: boolean; version: number; created_at: string; updated_at: string; search_vector?: unknown }
export type KnowledgeNoteLinkRow = { id: string; user_id: string; source_note_id: string; target_note_id: string | null; target_title: string; target_heading: string | null; display_text: string | null; created_at: string }
export type KnowledgeNoteVersionRow = { id: string; user_id: string; note_id: string; version: number; title: string; content: string; properties: Json; tags: string[]; aliases: string[]; created_at: string }
export type KnowledgeNoteTemplateRow = { id: string; user_id: string; name: string; content: string; properties: Json; tags: string[]; aliases: string[]; created_at: string; updated_at: string }
export type KnowledgeNoteProjectRow = { user_id: string; note_id: string; project_id: string; created_at: string }
export type KnowledgeNoteTaskRow = { user_id: string; note_id: string; task_id: string; created_at: string }
export type ProjectStatus = 'idea' | 'planned' | 'active' | 'paused' | 'completed' | 'archived'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectHealth = 'unset' | 'on_track' | 'at_risk' | 'off_track'
export type ProjectRow = { id: string; user_id: string; home_note_id: string | null; name: string; outcome: string; description: string; status: ProjectStatus; priority: ProjectPriority; health: ProjectHealth; start_date: string | null; target_date: string | null; color: string; icon: string; sort_order: number; completed_at: string | null; created_at: string; updated_at: string }
export type ProjectMilestoneRow = { id: string; user_id: string; project_id: string; title: string; status: 'open' | 'completed' | 'cancelled'; target_date: string | null; sort_order: number; completed_at: string | null; created_at: string; updated_at: string }

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
          birth_year: number | null
          onboarding_complete: boolean
          ai_assistant_enabled: boolean
          ai_consent_at: string | null
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
          birth_year?: number | null
          onboarding_complete?: boolean
          ai_assistant_enabled?: boolean
          ai_consent_at?: string | null
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
          birth_year?: number | null
          onboarding_complete?: boolean
          ai_assistant_enabled?: boolean
          ai_consent_at?: string | null
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
          insight_type: string | null
          topic_tags: string[]
          insight_marked_at: string | null
          insight_is_favorite: boolean
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
          insight_type?: string | null
          topic_tags?: string[]
          insight_marked_at?: string | null
          insight_is_favorite?: boolean
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
          insight_type?: string | null
          topic_tags?: string[]
          insight_marked_at?: string | null
          insight_is_favorite?: boolean
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
          skill_category: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
          skill_category?: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
          skill_category?: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
      workout_template_sets: MutableTable<WorkoutTemplateSetRow, 'template_exercise_id'>
      workout_sessions: MutableTable<WorkoutSessionRow, 'user_id' | 'name'>
      workout_session_exercises: MutableTable<WorkoutSessionExerciseRow, 'session_id' | 'exercise_id'>
      workout_sets: MutableTable<WorkoutSetRow, 'session_exercise_id'>
      workout_preferences: MutableTable<WorkoutPreferenceRow, 'user_id'>
      exercise_preferences: MutableTable<ExercisePreferenceRow, 'user_id' | 'exercise_id'>
      nutrition_targets: MutableTable<NutritionTargetRow, 'user_id'>
      nutrition_entries: MutableTable<NutritionEntryRow, 'user_id' | 'entry_date' | 'name'>
      food_items: MutableTable<FoodItemRow, 'user_id' | 'name'>
      food_portions: MutableTable<FoodPortionRow, 'food_item_id' | 'label' | 'grams'>
      food_favorites: MutableTable<FoodFavoriteRow, 'user_id' | 'food_item_id'>
      saved_meals: MutableTable<SavedMealRow, 'user_id' | 'name'>
      saved_meal_items: MutableTable<SavedMealItemRow, 'saved_meal_id' | 'food_item_id' | 'serving_grams'>
      recipes: MutableTable<RecipeRow, 'user_id' | 'name'>
      recipe_ingredients: MutableTable<RecipeIngredientRow, 'recipe_id' | 'food_item_id' | 'grams'>
      challenge_templates: MutableTable<ChallengeTemplateRow, 'created_by' | 'title' | 'duration_days'>
      challenge_days: MutableTable<ChallengeDayRow, 'template_id' | 'day_number' | 'title' | 'instructions'>
      challenge_enrollments: MutableTable<ChallengeEnrollmentRow, 'template_id' | 'user_id' | 'start_date'>
      challenge_day_progress: MutableTable<ChallengeDayProgressRow, 'enrollment_id' | 'challenge_day_id' | 'user_id' | 'day_number' | 'completed_on'>
      admin_notes: MutableTable<AdminNoteRow, 'user_id' | 'title'>
      knowledge_folders: MutableTable<KnowledgeFolderRow, 'user_id' | 'name'>
      knowledge_notes: MutableTable<KnowledgeNoteRow, 'user_id' | 'title' | 'slug'>
      knowledge_note_links: MutableTable<KnowledgeNoteLinkRow, 'user_id' | 'source_note_id' | 'target_title'>
      knowledge_note_versions: MutableTable<KnowledgeNoteVersionRow, 'user_id' | 'note_id' | 'version' | 'title' | 'content'>
      knowledge_note_templates: MutableTable<KnowledgeNoteTemplateRow, 'user_id' | 'name'>
      knowledge_note_projects: MutableTable<KnowledgeNoteProjectRow, 'user_id' | 'note_id' | 'project_id'>
      knowledge_note_tasks: MutableTable<KnowledgeNoteTaskRow, 'user_id' | 'note_id' | 'task_id'>
      projects: MutableTable<ProjectRow, 'user_id' | 'name'>
      project_milestones: MutableTable<ProjectMilestoneRow, 'user_id' | 'project_id' | 'title'>
      xp_events: {
        Row: {
          id: string
          user_id: string
          source_type: string
          source_id: string | null
          xp_amount: number
          description: string
          skill_category: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_type: string
          source_id?: string | null
          xp_amount: number
          description: string
          skill_category?: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_type?: string
          source_id?: string | null
          xp_amount?: number
          description?: string
          skill_category?: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
      avatar_states: {
        Row: {
          id: string
          user_id: string
          unlocked_item_ids: string[]
          equipped_items: Record<string, string | null>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          unlocked_item_ids?: string[]
          equipped_items?: Record<string, string | null>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          unlocked_item_ids?: string[]
          equipped_items?: Record<string, string | null>
          created_at?: string
          updated_at?: string
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
          skill_category: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
          skill_category?: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
          skill_category?: 'physical_health' | 'mental_health' | 'focus' | 'learning' | 'relationships' | 'career' | null
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
      get_published_learning_catalog: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_learning_progress: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      submit_learning_exercise: {
        Args: {
          p_lesson_slug: string
          p_exercise_slug: string
          p_response: Json
        }
        Returns: Json
      }
      admin_get_learning_catalog: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_save_learning_catalog: {
        Args: {
          p_catalog: Json
          p_change_summary?: string | null
        }
        Returns: Json
      }
      admin_publish_learning_catalog: {
        Args: {
          p_change_summary?: string | null
        }
        Returns: Json
      }
      admin_app_stats: {
        Args: Record<PropertyKey, never>
        Returns: { total_users: number }[]
      }
      start_workout: {
        Args: { p_template_id?: string | null; p_name?: string }
        Returns: string
      }
      finish_workout: {
        Args: { p_session_id: string; p_status?: 'completed' | 'cancelled' }
        Returns: WorkoutSessionRow
      }
      clone_workout_template: {
        Args: { p_template_id: string }
        Returns: string
      }
      save_knowledge_note: {
        Args: {
          p_note_id: string | null
          p_expected_version: number
          p_title: string
          p_content: string
          p_folder_id: string | null
          p_note_type: KnowledgeNoteType
          p_properties: Json
          p_tags: string[]
          p_aliases: string[]
          p_is_pinned: boolean
          p_links: Json
          p_checkpoint?: boolean
        }
        Returns: { saved_note_id: string; saved_version: number; saved_updated_at: string }[]
      }
      create_project_with_home_note: {
        Args: {
          p_name: string
          p_outcome: string
          p_status?: ProjectStatus
          p_priority?: ProjectPriority
        }
        Returns: { created_project_id: string; created_note_id: string }[]
      }
      save_workout_template: {
        Args: { p_template_id: string | null; p_name: string; p_notes: string | null; p_items: Json }
        Returns: string
      }
      log_saved_meal: {
        Args: { p_saved_meal_id: string; p_entry_date: string; p_meal_type?: MealType }
        Returns: number
      }
      log_recipe: {
        Args: { p_recipe_id: string; p_entry_date: string; p_meal_type?: MealType; p_serving_count?: number }
        Returns: string
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

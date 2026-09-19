import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export async function supabaseInsert<
  T extends keyof Database['public']['Tables']
>(
  supabase: SupabaseClient,
  table: T,
  payload:
    | Database['public']['Tables'][T]['Insert']
    | Database['public']['Tables'][T]['Insert'][]
) {
  return (supabase.from(table as string) as any).insert(payload as any)
}

export async function supabaseUpdate<
  T extends keyof Database['public']['Tables']
>(
  supabase: SupabaseClient,
  table: T,
  payload:
    | Partial<Database['public']['Tables'][T]['Update']>
    | Partial<Database['public']['Tables'][T]['Update']>[]
) {
  return (supabase.from(table as string) as any).update(payload as any)
}

export function supabaseSelect<
  T extends keyof Database['public']['Tables']
>(supabase: SupabaseClient, table: T, select: string) {
  return (supabase.from(table as string) as any).select(select as any)
}

export function supabaseFrom<
  T extends keyof Database['public']['Tables']
>(supabase: SupabaseClient, table: T) {
  return (supabase.from(table as string) as any)
}

export async function supabaseUpdateWhere<
  T extends keyof Database['public']['Tables']
>(
  supabase: SupabaseClient,
  table: T,
  payload:
    | Partial<Database['public']['Tables'][T]['Update']>
    | Partial<Database['public']['Tables'][T]['Update']>[],
  eqField: string,
  eqValue: any
) {
  return (supabase.from(table as string) as any).update(payload as any).eq(eqField, eqValue as any)
}

/**
 * Like supabaseUpdateWhere, but returns the updated rows so a caller can
 * tell an RLS-filtered no-op (data: []) from a real update. Postgres does
 * not raise when a row-level security policy filters the target row out of
 * an UPDATE -- it just updates zero rows -- so PostgREST answers with
 * `error: null` and no `.select()` leaves that indistinguishable from a
 * real success. Selecting the row back closes that gap.
 */
export async function supabaseUpdateWhereReturning<
  T extends keyof Database['public']['Tables']
>(
  supabase: SupabaseClient,
  table: T,
  payload:
    | Partial<Database['public']['Tables'][T]['Update']>
    | Partial<Database['public']['Tables'][T]['Update']>[],
  eqField: string,
  eqValue: any,
  select: string = '*'
) {
  return (supabase.from(table as string) as any)
    .update(payload as any)
    .eq(eqField, eqValue as any)
    .select(select as any)
}

export type DB = Database

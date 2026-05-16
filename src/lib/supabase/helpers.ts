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

export type DB = Database

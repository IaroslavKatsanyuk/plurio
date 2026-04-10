import { createClient } from "@supabase/supabase-js";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * URL проєкту для серверного клієнта: на Vercel часто задають лише SUPABASE_URL,
 * без дубліката NEXT_PUBLIC_* — service role все одно має працювати.
 */
function resolveSupabaseUrlForServiceRole(): string | null {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  return url || null;
}

/**
 * Service-role клієнт: обходить RLS, лише для довірених серверних сценаріїв
 * (наприклад публічне бронювання після валідації).
 * Потрібна змінна середовища SUPABASE_SERVICE_ROLE_KEY (не експортувати в клієнт).
 */
export function tryCreateAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = resolveSupabaseUrlForServiceRole();
  if (!serviceRoleKey || !url) {
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

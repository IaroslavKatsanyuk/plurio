import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "./env";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role клієнт: обходить RLS, лише для довірених серверних сценаріїв
 * (наприклад публічне бронювання після валідації).
 * Потрібна змінна середовища SUPABASE_SERVICE_ROLE_KEY (не експортувати в клієнт).
 */
export function tryCreateAdminClient(): SupabaseClient | null {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    return null;
  }
  const { url } = getSupabasePublicEnv();
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

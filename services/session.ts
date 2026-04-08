import { createClient as createSupabaseClient } from "@/lib/supabase/server";

import type { ServiceResult } from "./types";

/**
 * Серверний контекст: клієнт Supabase + id користувача з сесії.
 * Без авторизації — помилка UNAUTHORIZED.
 */
export async function getAuthenticatedContext(): Promise<
  ServiceResult<{
    supabase: Awaited<ReturnType<typeof createSupabaseClient>>;
    userId: string;
  }>
> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return {
      ok: false,
      error: { code: "AUTH_ERROR", message: error.message },
    };
  }
  if (!user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Потрібна авторизація.",
      },
    };
  }

  return { ok: true, data: { supabase, userId: user.id } };
}

import { createClient } from "@/lib/supabase/server";

export type HealthResult =
  | {
      status: "ok";
      checks: { supabaseProjectReachable: true };
    }
  | {
      status: "error";
      error: { code: string; message: string };
    };

/**
 * Перевіряє доступність проєкту Supabase (Auth API + ключі).
 * Не виконує довільний SQL; для перевірки конкретних таблиць додай окремий метод після міграцій.
 */
export async function getHealthStatus(): Promise<HealthResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return {
        status: "error",
        error: { code: "SUPABASE_AUTH", message: error.message },
      };
    }
    return {
      status: "ok",
      checks: { supabaseProjectReachable: true },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      status: "error",
      error: { code: "CONFIG_OR_NETWORK", message },
    };
  }
}

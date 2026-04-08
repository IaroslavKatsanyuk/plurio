import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "./env";

export type SessionUpdateResult = {
  response: NextResponse;
  user: User | null;
};

/**
 * Оновлює сесію, синхронізує cookies і повертає поточного користувача (для захисту маршрутів).
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdateResult> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}

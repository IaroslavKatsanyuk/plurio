import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Обмін коду підтвердження email / OAuth на сесію (Supabase redirect).
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next");
  const next = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/appointments";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

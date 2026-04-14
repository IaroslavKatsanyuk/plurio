import { getAuthenticatedContext } from "./session";
import type { ServiceResult } from "./types";

export async function getOwnerInboxUnreadCount(): Promise<ServiceResult<number>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { count, error } = await supabase
    .from("owner_inbox_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    return {
      ok: false,
      error: {
        code: "OWNER_INBOX_QUERY",
        message: "Не вдалося завантажити сповіщення.",
      },
    };
  }

  return { ok: true, data: count ?? 0 };
}

export async function markOwnerInboxAllRead(): Promise<ServiceResult<void>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("owner_inbox_events")
    .update({ read_at: nowIso })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    return {
      ok: false,
      error: {
        code: "OWNER_INBOX_UPDATE",
        message: "Не вдалося позначити сповіщення як прочитані.",
      },
    };
  }

  return { ok: true, data: undefined };
}

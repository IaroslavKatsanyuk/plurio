import { getAuthenticatedContext } from "./session";
import type {
  ClientRow,
  CreateClientInput,
  ServiceResult,
} from "./types";

/**
 * Створює запис клієнта (CRM) для поточного користувача.
 */
export async function createClient(
  input: CreateClientInput,
): Promise<ServiceResult<ClientRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "CLIENT_CREATE_FAILED",
        message: "Не вдалося створити клієнта.",
      },
    };
  }

  return { ok: true, data: data as ClientRow };
}

/**
 * Список клієнтів поточного користувача (новіші спочатку).
 */
export async function getClients(): Promise<ServiceResult<ClientRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      error: {
        code: "CLIENT_LIST_FAILED",
        message: "Не вдалося завантажити клієнтів.",
      },
    };
  }

  return { ok: true, data: (data ?? []) as ClientRow[] };
}

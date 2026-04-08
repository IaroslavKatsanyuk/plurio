import { getAuthenticatedContext } from "./session";
import type {
  ClientRow,
  CreateClientInput,
  ServiceResult,
  UpdateClientInput,
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
      telegram_username: input.telegram_username?.trim() || null,
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

/**
 * Оновлює дані клієнта поточного користувача.
 */
export async function updateClient(
  id: string,
  input: UpdateClientInput,
): Promise<ServiceResult<ClientRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const payload: Record<string, string | null> = {};
  if (typeof input.name === "string") {
    payload.name = input.name.trim();
  }
  if (input.telegram_username !== undefined) {
    payload.telegram_username = input.telegram_username?.trim() || null;
  }
  if (input.email !== undefined) {
    payload.email = input.email?.trim() || null;
  }
  if (input.phone !== undefined) {
    payload.phone = input.phone?.trim() || null;
  }
  if (input.notes !== undefined) {
    payload.notes = input.notes?.trim() || null;
  }

  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "CLIENT_UPDATE_FAILED",
        message: "Не вдалося оновити клієнта.",
      },
    };
  }

  return { ok: true, data: data as ClientRow };
}

/**
 * Видаляє клієнта поточного користувача.
 */
export async function deleteClient(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: {
        code: "CLIENT_DELETE_FAILED",
        message: "Не вдалося видалити клієнта.",
      },
    };
  }

  return { ok: true, data: { id } };
}

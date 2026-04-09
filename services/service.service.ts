import { getAuthenticatedContext } from "./session";
import type {
  CreateServiceInput,
  ServiceResult,
  ServiceRow,
  UpdateServiceInput,
} from "./types";

export async function createService(
  input: CreateServiceInput,
): Promise<ServiceResult<ServiceRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("services")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      duration_minutes: input.duration_minutes,
    })
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: { code: "SERVICE_CREATE_FAILED", message: "Не вдалося створити послугу." },
    };
  }

  return { ok: true, data: data as ServiceRow };
}

export async function getServices(): Promise<ServiceResult<ServiceRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      error: { code: "SERVICE_LIST_FAILED", message: "Не вдалося завантажити послуги." },
    };
  }

  return { ok: true, data: (data ?? []) as ServiceRow[] };
}

export async function updateService(
  id: string,
  input: UpdateServiceInput,
): Promise<ServiceResult<ServiceRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const payload: Record<string, string | number> = {};
  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }
  if (input.duration_minutes !== undefined) {
    payload.duration_minutes = input.duration_minutes;
  }

  const { data, error } = await supabase
    .from("services")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: { code: "SERVICE_UPDATE_FAILED", message: "Не вдалося оновити послугу." },
    };
  }

  return { ok: true, data: data as ServiceRow };
}

export async function deleteService(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: { code: "SERVICE_DELETE_FAILED", message: "Не вдалося видалити послугу." },
    };
  }

  return { ok: true, data: { id } };
}

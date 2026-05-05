import { getAuthenticatedContext } from "./session";
import type {
  CreateServiceInput,
  ServiceResult,
  ServiceRow,
  UpdateServiceInput,
} from "./types";

function normalizeServiceRow(raw: Record<string, unknown>): ServiceRow {
  const priceRaw = raw.price;
  const priceParsed =
    typeof priceRaw === "number" && Number.isFinite(priceRaw)
      ? priceRaw
      : Number.parseFloat(String(priceRaw ?? "0"));
  const duration = Number(raw.duration_minutes);
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    name: String(raw.name ?? ""),
    duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0,
    price: Number.isFinite(priceParsed) && priceParsed >= 0 ? priceParsed : 0,
    category: raw.category == null || raw.category === "" ? null : String(raw.category),
    description: raw.description == null || raw.description === "" ? null : String(raw.description),
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function createService(
  input: CreateServiceInput,
): Promise<ServiceResult<ServiceRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const price = input.price ?? 0;
  if (!Number.isFinite(price) || price < 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Ціна не може бути від'ємною." },
    };
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("services")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      duration_minutes: input.duration_minutes,
      price,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: { code: "SERVICE_CREATE_FAILED", message: "Не вдалося створити послугу." },
    };
  }

  return { ok: true, data: normalizeServiceRow(data as Record<string, unknown>) };
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

  return {
    ok: true,
    data: (data ?? []).map((row) => normalizeServiceRow(row as Record<string, unknown>)),
  };
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
  const payload: Record<string, string | number | null> = {};
  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }
  if (input.duration_minutes !== undefined) {
    payload.duration_minutes = input.duration_minutes;
  }
  if (input.price !== undefined) {
    if (!Number.isFinite(input.price) || input.price < 0) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Ціна не може бути від'ємною." },
      };
    }
    payload.price = input.price;
  }
  if (input.category !== undefined) {
    payload.category = input.category?.trim() || null;
  }
  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }

  if (Object.keys(payload).length === 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Немає полів для оновлення." },
    };
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

  return { ok: true, data: normalizeServiceRow(data as Record<string, unknown>) };
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

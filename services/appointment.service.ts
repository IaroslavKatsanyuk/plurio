import { getAuthenticatedContext } from "./session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentStatus,
  AppointmentRow,
  CreateAppointmentInput,
  ServiceResult,
} from "./types";

type UpdateAppointmentInput = {
  client_id?: string | null;
  title?: string | null;
  starts_at?: string;
  ends_at?: string;
  status?: AppointmentStatus;
  notes?: string | null;
};

async function hasTimeOverlap(params: {
  userId: string;
  startsAt: string;
  endsAt: string;
  excludeId?: string;
  supabase: SupabaseClient;
}): Promise<boolean> {
  const query = params.supabase
    .from("appointments")
    .select("id")
    .eq("user_id", params.userId)
    .lt("starts_at", params.endsAt)
    .gt("ends_at", params.startsAt)
    .limit(1);

  const withExclude = params.excludeId
    ? query.neq("id", params.excludeId)
    : query;
  const { data, error } = await withExclude;
  if (error) {
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Створює запис (appointment) для поточного користувача.
 * client_id має належати цьому ж користувачу (перевірка на рівні БД).
 */
export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<ServiceResult<AppointmentRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const overlap = await hasTimeOverlap({
    supabase,
    userId,
    startsAt: input.starts_at,
    endsAt: input.ends_at,
  });
  if (overlap) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_TIME_OVERLAP",
        message: "Цей час уже зайнятий іншим записом.",
      },
    };
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      user_id: userId,
      client_id: input.client_id ?? null,
      title: input.title?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status: input.status ?? "scheduled",
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_CREATE_FAILED",
        message: "Не вдалося створити запис.",
      },
    };
  }

  return { ok: true, data: data as AppointmentRow };
}

/**
 * Повертає список записів поточного користувача.
 */
export async function getAppointments(): Promise<ServiceResult<AppointmentRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .order("starts_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_LIST_FAILED",
        message: "Не вдалося завантажити записи.",
      },
    };
  }

  return { ok: true, data: (data ?? []) as AppointmentRow[] };
}

/**
 * Оновлює статус запису поточного користувача.
 */
export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<ServiceResult<AppointmentRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_STATUS_UPDATE_FAILED",
        message: "Не вдалося оновити статус запису.",
      },
    };
  }

  return { ok: true, data: data as AppointmentRow };
}

/**
 * Повне редагування запису поточного користувача.
 */
export async function updateAppointment(
  id: string,
  input: UpdateAppointmentInput,
): Promise<ServiceResult<AppointmentRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const { data: existing } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  const nextStartsAt = input.starts_at ?? existing?.starts_at;
  const nextEndsAt = input.ends_at ?? existing?.ends_at;
  if (nextStartsAt && nextEndsAt) {
    const overlap = await hasTimeOverlap({
      supabase,
      userId,
      startsAt: nextStartsAt,
      endsAt: nextEndsAt,
      excludeId: id,
    });
    if (overlap) {
      return {
        ok: false,
        error: {
          code: "APPOINTMENT_TIME_OVERLAP",
          message: "Цей час уже зайнятий іншим записом.",
        },
      };
    }
  }

  const payload: Record<string, string | null> = {};

  if (input.client_id !== undefined) {
    payload.client_id = input.client_id ?? null;
  }
  if (input.title !== undefined) {
    payload.title = input.title?.trim() || null;
  }
  if (input.starts_at !== undefined) {
    payload.starts_at = input.starts_at;
  }
  if (input.ends_at !== undefined) {
    payload.ends_at = input.ends_at;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }
  if (input.notes !== undefined) {
    payload.notes = input.notes?.trim() || null;
  }

  const { data, error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_UPDATE_FAILED",
        message: "Не вдалося оновити запис.",
      },
    };
  }

  return { ok: true, data: data as AppointmentRow };
}

/**
 * Видаляє запис поточного користувача.
 */
export async function deleteAppointment(
  id: string,
): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_DELETE_FAILED",
        message: "Не вдалося видалити запис.",
      },
    };
  }

  return { ok: true, data: { id } };
}

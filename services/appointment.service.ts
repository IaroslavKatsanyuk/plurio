import { getAuthenticatedContext } from "./session";
import type {
  AppointmentRow,
  CreateAppointmentInput,
  ServiceResult,
} from "./types";

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

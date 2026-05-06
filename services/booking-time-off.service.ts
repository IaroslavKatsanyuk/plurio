import { getAuthenticatedContext } from "./session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BookingTimeOffRange,
  BookingTimeOffRow,
  CreateBookingTimeOffInput,
  ServiceResult,
} from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDbDate(raw: unknown): string {
  const s = String(raw ?? "");
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function mapBookingTimeOffRow(row: Record<string, unknown>): BookingTimeOffRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    start_date: normalizeDbDate(row.start_date),
    end_date: normalizeDbDate(row.end_date),
    note: row.note == null ? null : String(row.note),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

/**
 * Діапазони для перевірки слотів (виклик лише з серверного коду з довіреним userId).
 */
export async function getBookingTimeOffRangesForUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<BookingTimeOffRange[]> {
  const { data, error } = await supabase
    .from("booking_time_off")
    .select("start_date, end_date")
    .eq("user_id", userId);

  if (error || !data) {
    return [];
  }
  return (data as { start_date: unknown; end_date: unknown }[]).map((r) => ({
    start_date: normalizeDbDate(r.start_date),
    end_date: normalizeDbDate(r.end_date),
  }));
}

export async function listBookingTimeOff(): Promise<ServiceResult<BookingTimeOffRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("booking_time_off")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false,
      error: {
        code: "TIME_OFF_LIST_FAILED",
        message: "Не вдалося завантажити неробочі періоди.",
      },
    };
  }

  return {
    ok: true,
    data: (data ?? []).map((r) => mapBookingTimeOffRow(r as Record<string, unknown>)),
  };
}

export async function createBookingTimeOff(
  input: CreateBookingTimeOffInput,
): Promise<ServiceResult<BookingTimeOffRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const start_date = input.start_date?.trim() ?? "";
  const end_date = input.end_date?.trim() ?? "";
  if (!ISO_DATE.test(start_date) || !ISO_DATE.test(end_date)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Очікується дата у форматі YYYY-MM-DD.",
      },
    };
  }
  if (end_date < start_date) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Кінцева дата не може бути раніше за початкову.",
      },
    };
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("booking_time_off")
    .insert({
      user_id: userId,
      start_date,
      end_date,
      note: input.note?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "TIME_OFF_CREATE_FAILED",
        message: "Не вдалося зберегти період.",
      },
    };
  }

  return { ok: true, data: mapBookingTimeOffRow(data as Record<string, unknown>) };
}

export async function deleteBookingTimeOff(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase
    .from("booking_time_off")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: {
        code: "TIME_OFF_DELETE_FAILED",
        message: "Не вдалося видалити період.",
      },
    };
  }

  return { ok: true, data: { id } };
}

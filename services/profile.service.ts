import { randomBytes } from "node:crypto";

import {
  DEFAULT_BOOKING_TIMEZONE,
  isValidIanaTimezone,
  legacyDefaultSchedule,
  normalizeProfileWeeklySchedule,
  WEEKDAY_KEYS,
  type WorkWeeklySchedule,
} from "@/lib/work-schedule";
import { getAuthenticatedContext } from "./session";
import type { ProfileRow, ServiceResult } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Повертає профіль поточного користувача (рядок profiles або null).
 */
export async function getProfile(): Promise<ServiceResult<ProfileRow | null>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id, display_name, booking_slug, booking_timezone, work_weekly_schedule, telegram_chat_id, telegram_link_token, created_at, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: {
        code: "PROFILE_LOAD_FAILED",
        message: "Не вдалося завантажити профіль.",
      },
    };
  }

  return { ok: true, data: data as ProfileRow | null };
}

const profileSelectFields =
  "user_id, display_name, booking_slug, booking_timezone, work_weekly_schedule, telegram_chat_id, telegram_link_token, created_at, updated_at";

/**
 * Контекст графіку для валідації записів (RLS: лише власний профіль через виклик з auth).
 */
export async function getBookingWorkContextForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ timezone: string; schedule: WorkWeeklySchedule }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("booking_timezone, work_weekly_schedule")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      timezone: DEFAULT_BOOKING_TIMEZONE,
      schedule: legacyDefaultSchedule(),
    };
  }

  const row = data as {
    booking_timezone?: string | null;
    work_weekly_schedule?: unknown | null;
  };
  const tz = row.booking_timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
  const safeTz = isValidIanaTimezone(tz) ? tz : DEFAULT_BOOKING_TIMEZONE;
  return {
    timezone: safeTz,
    schedule: normalizeProfileWeeklySchedule(row.work_weekly_schedule),
  };
}

/**
 * Зберігає таймзону та тижневий графік для бронювання.
 */
export async function updateBookingWorkSchedule(input: {
  booking_timezone: string;
  work_weekly_schedule: WorkWeeklySchedule;
}): Promise<ServiceResult<ProfileRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const tz = input.booking_timezone.trim();
  if (!isValidIanaTimezone(tz)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Некоректна часова зона (очікується IANA, наприклад Europe/Kyiv).",
      },
    };
  }

  const hasAnyWorkingDay = WEEKDAY_KEYS.some(
    (k) => input.work_weekly_schedule[k].length > 0,
  );
  if (!hasAnyWorkingDay) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Оберіть хоча б один робочий день із годинами прийому.",
      },
    };
  }

  const { supabase, userId } = ctx.data;

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    return {
      ok: false,
      error: {
        code: "PROFILE_LOAD_FAILED",
        message: "Не вдалося перевірити профіль.",
      },
    };
  }

  const payload = {
    booking_timezone: tz,
    work_weekly_schedule: input.work_weekly_schedule,
  };

  if (!existing) {
    const { data: inserted, error: insertError } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        ...payload,
      })
      .select(profileSelectFields)
      .single();

    if (insertError || !inserted) {
      return {
        ok: false,
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "Не вдалося зберегти графік.",
        },
      };
    }
    return { ok: true, data: inserted as ProfileRow };
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", userId)
    .select(profileSelectFields)
    .single();

  if (updateError || !updated) {
    return {
      ok: false,
      error: {
        code: "PROFILE_UPDATE_FAILED",
        message: "Не вдалося зберегти графік.",
      },
    };
  }

  return { ok: true, data: updated as ProfileRow };
}

const TELEGRAM_LINK_TOKEN_BYTES = 24;

/**
 * Генерує одноразовий токен для deep link у Telegram-бота (t.me/bot?start=...).
 */
export async function issueTelegramLinkToken(): Promise<ServiceResult<{ token: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const token = randomBytes(TELEGRAM_LINK_TOKEN_BYTES).toString("hex");

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    return {
      ok: false,
      error: {
        code: "PROFILE_LOAD_FAILED",
        message: "Не вдалося перевірити профіль.",
      },
    };
  }

  if (!existing) {
    const { error: insertError } = await supabase.from("profiles").insert({
      user_id: userId,
      telegram_link_token: token,
    });
    if (insertError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "Не вдалося зберегти токен для Telegram.",
        },
      };
    }
  } else {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ telegram_link_token: token })
      .eq("user_id", userId);
    if (updateError) {
      return {
        ok: false,
        error: {
          code: "PROFILE_UPDATE_FAILED",
          message: "Не вдалося зберегти токен для Telegram.",
        },
      };
    }
  }

  return { ok: true, data: { token } };
}

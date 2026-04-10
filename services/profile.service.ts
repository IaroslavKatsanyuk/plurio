import { randomBytes } from "node:crypto";

import { getAuthenticatedContext } from "./session";
import type { ProfileRow, ServiceResult } from "./types";

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
      "user_id, display_name, booking_slug, telegram_chat_id, telegram_link_token, created_at, updated_at",
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

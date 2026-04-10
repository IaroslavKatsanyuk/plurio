import type { SupabaseClient } from "@supabase/supabase-js";

import { tryCreateAdminClient } from "@/lib/supabase/admin";

const TELEGRAM_API = "https://api.telegram.org";

/** Підсумок для API/UI (без секретів). */
export type TelegramBookingNotifyMeta =
  | { status: "sent"; message: string }
  | { status: "skipped"; code: string; message: string }
  | { status: "failed"; code: string; message: string };

type ClientEmbed = {
  name: string | null;
  telegram_chat_id?: number | string | bigint | null;
};

type ServiceEmbed = { name: string | null };

/** Supabase may return a single embed or an array depending on generated types. */
function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * DB column is bigint; runtime value may be number, string, or BigInt.
 * JSON.stringify throws on BigInt — Telegram API accepts string or number chat_id.
 */
function normalizeChatIdForTelegramApi(
  raw: string | number | bigint | null | undefined,
): string | number | null {
  if (raw == null || raw === "") {
    return null;
  }
  if (typeof raw === "bigint") {
    return raw.toString();
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw !== 0 ? raw : null;
  }
  const s = String(raw).trim();
  if (!s || s === "0") {
    return null;
  }
  return /^\d+$/.test(s) ? (s.length > 12 ? s : Number(s)) : s;
}

/**
 * Sends booking confirmation in Telegram and sets telegram_reminder_24h_sent_at.
 * Cron skips rows that already have this timestamp.
 *
 * Must be awaited from API handlers: on serverless (e.g. Vercel) fire-and-forget work
 * is often killed right after the HTTP response, so "void ..." fails in prod while dev works.
 */
export async function runTelegramBookingNotification(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<TelegramBookingNotifyMeta> {
  try {
    return await sendImmediateBookingTelegram(supabase, appointmentId);
  } catch (err: unknown) {
    console.error("[telegram-immediate-booking] unexpected error", err);
    return {
      status: "failed",
      code: "UNEXPECTED",
      message:
        "Внутрішня помилка при відправці в Telegram. Див. логи сервера (Vercel → Logs), не консоль браузера.",
    };
  }
}

async function sendImmediateBookingTelegram(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<TelegramBookingNotifyMeta> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const admin = tryCreateAdminClient();
  console.info("[telegram-immediate-booking] start", {
    appointmentId,
    tokenConfigured: Boolean(token),
    usingServiceRole: Boolean(admin),
  });

  if (!token) {
    console.warn(
      "[telegram-immediate-booking] skip: TELEGRAM_BOT_TOKEN is not set (add it to the Next.js / hosting env, not only Supabase secrets)",
    );
    return {
      status: "skipped",
      code: "NO_TOKEN",
      message:
        "Telegram: не відправлено — на сервері (Vercel) немає TELEGRAM_BOT_TOKEN для Production або не було Redeploy.",
    };
  }

  // Prefer service role on the server: same DB reads/writes as local, without RLS/embed edge cases on prod.
  const db = admin ?? supabase;

  const { data: row, error } = await db
    .from("appointments")
    .select(
      "id, starts_at, title, status, client_id, clients(name, telegram_chat_id), services(name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("[telegram-immediate-booking] skip: appointment select failed", appointmentId, error);
    return {
      status: "failed",
      code: "APPOINTMENT_QUERY",
      message: "Telegram: не вдалося прочитати запис з бази (див. логи сервера).",
    };
  }
  if (!row?.client_id) {
    console.warn("[telegram-immediate-booking] skip: no client_id", appointmentId);
    return {
      status: "skipped",
      code: "NO_CLIENT",
      message: "Telegram: у запису немає клієнта — повідомлення не надсилається.",
    };
  }

  const apt = row as unknown as {
    id: string;
    starts_at: string;
    title: string | null;
    status: string;
    client_id: string;
    clients: ClientEmbed | ClientEmbed[] | null;
    services: ServiceEmbed | ServiceEmbed[] | null;
  };

  if (apt.status !== "scheduled" && apt.status !== "confirmed") {
    console.warn("[telegram-immediate-booking] skip: status", appointmentId, apt.status);
    return {
      status: "skipped",
      code: "BAD_STATUS",
      message: "Telegram: статус запису не підходить для підтвердження.",
    };
  }

  const startsAt = new Date(apt.starts_at);
  const startMs = startsAt.getTime();
  if (!Number.isFinite(startMs)) {
    console.warn("[telegram-immediate-booking] skip: invalid starts_at", appointmentId);
    return {
      status: "skipped",
      code: "INVALID_STARTS_AT",
      message: "Telegram: некоректний час початку запису.",
    };
  }

  let client = firstEmbed(apt.clients);
  if (
    (client?.telegram_chat_id == null || client?.telegram_chat_id === "") &&
    apt.client_id
  ) {
    const { data: cRow, error: clientErr } = await db
      .from("clients")
      .select("name, telegram_chat_id")
      .eq("id", apt.client_id)
      .maybeSingle();
    if (clientErr) {
      console.error(
        "[telegram-immediate-booking] client row select failed (fallback)",
        appointmentId,
        clientErr,
      );
    } else if (cRow) {
      const cr = cRow as { name: string | null; telegram_chat_id: number | string | null };
      client = { name: cr.name, telegram_chat_id: cr.telegram_chat_id };
    }
  }

  const chatId = normalizeChatIdForTelegramApi(client?.telegram_chat_id);
  if (chatId == null) {
    console.warn(
      "[telegram-immediate-booking] skip: no telegram_chat_id — client must tap «Telegram link» from dashboard and open the bot (username alone is not enough for instant DMs)",
      appointmentId,
    );
    return {
      status: "skipped",
      code: "NO_CHAT_ID",
      message:
        "Telegram: клієнт не підключив бота — надішли «Telegram link» з таблиці клієнтів, нехай відкриє бота й натисне Start.",
    };
  }

  const { data: marker } = await db
    .from("appointments")
    .select("telegram_reminder_24h_sent_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (marker && (marker as { telegram_reminder_24h_sent_at?: string | null }).telegram_reminder_24h_sent_at) {
    return {
      status: "skipped",
      code: "ALREADY_SENT",
      message: "Telegram: підтвердження для цього запису вже було відправлено раніше.",
    };
  }

  const whenLabel = startsAt.toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines = ["Plurio: запис підтверджено.", `Час: ${whenLabel}`];
  if (apt.title) {
    lines.push(`Назва: ${apt.title}`);
  }
  const clientName = client?.name?.trim();
  if (clientName) {
    lines.push(`Ім'я: ${clientName}`);
  }
  const service = firstEmbed(apt.services);
  const serviceName = service?.name?.trim();
  if (serviceName) {
    lines.push(`Послуга: ${serviceName}`);
  }
  const text = lines.join("\n");

  const tgRes = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!tgRes.ok) {
    const detail = await tgRes.text();
    console.error("[telegram-immediate-booking] Telegram sendMessage failed", appointmentId, tgRes.status, detail);
    return {
      status: "failed",
      code: "TELEGRAM_API",
      message: `Telegram відхилив відправку (HTTP ${tgRes.status}). Перевір токен і чи клієнт не заблокував бота.`,
    };
  }

  console.info("[telegram-immediate-booking] sendMessage ok", appointmentId);

  const sentAt = new Date().toISOString();
  const { error: updError } = await db
    .from("appointments")
    .update({ telegram_reminder_24h_sent_at: sentAt })
    .eq("id", appointmentId);

  if (updError) {
    console.error("[telegram-immediate-booking] failed to mark sent", appointmentId, updError);
    return {
      status: "sent",
      message:
        "Повідомлення в Telegram, ймовірно, доставлено, але не вдалося оновити запис у базі (мітка часу). Перевір логи.",
    };
  }

  return { status: "sent", message: "Підтвердження запису надіслано в Telegram." };
}

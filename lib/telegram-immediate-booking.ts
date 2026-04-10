import type { SupabaseClient } from "@supabase/supabase-js";

const TELEGRAM_API = "https://api.telegram.org";

type ClientEmbed = {
  name: string | null;
  telegram_chat_id?: number | string | null;
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
 * Sends booking confirmation in Telegram and sets telegram_reminder_24h_sent_at.
 * Cron skips rows that already have this timestamp.
 *
 * Must be awaited from API handlers: on serverless (e.g. Vercel) fire-and-forget work
 * is often killed right after the HTTP response, so "void ..." fails in prod while dev works.
 */
export async function runTelegramBookingNotification(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<void> {
  try {
    await sendImmediateBookingTelegram(supabase, appointmentId);
  } catch (err: unknown) {
    console.error("[telegram-immediate-booking] unexpected error", err);
  }
}

async function sendImmediateBookingTelegram(
  supabase: SupabaseClient,
  appointmentId: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    console.warn(
      "[telegram-immediate-booking] skip: TELEGRAM_BOT_TOKEN is not set (add it to the Next.js / hosting env, not only Supabase secrets)",
    );
    return;
  }

  const { data: row, error } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, title, status, client_id, clients(name, telegram_chat_id), services(name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (error) {
    console.error("[telegram-immediate-booking] skip: appointment select failed", appointmentId, error);
    return;
  }
  if (!row?.client_id) {
    console.warn("[telegram-immediate-booking] skip: no client_id", appointmentId);
    return;
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
    return;
  }

  const startsAt = new Date(apt.starts_at);
  const startMs = startsAt.getTime();
  if (!Number.isFinite(startMs)) {
    console.warn("[telegram-immediate-booking] skip: invalid starts_at", appointmentId);
    return;
  }

  const client = firstEmbed(apt.clients);
  const chatId = client?.telegram_chat_id;
  if (chatId == null || chatId === "") {
    console.warn(
      "[telegram-immediate-booking] skip: client has no telegram_chat_id (client must open bot link from dashboard)",
      appointmentId,
    );
    return;
  }

  const { data: marker } = await supabase
    .from("appointments")
    .select("telegram_reminder_24h_sent_at")
    .eq("id", appointmentId)
    .maybeSingle();

  if (marker && (marker as { telegram_reminder_24h_sent_at?: string | null }).telegram_reminder_24h_sent_at) {
    return;
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
    return;
  }

  const sentAt = new Date().toISOString();
  const { error: updError } = await supabase
    .from("appointments")
    .update({ telegram_reminder_24h_sent_at: sentAt })
    .eq("id", appointmentId);

  if (updError) {
    console.error("[telegram-immediate-booking] failed to mark sent", appointmentId, updError);
  }
}

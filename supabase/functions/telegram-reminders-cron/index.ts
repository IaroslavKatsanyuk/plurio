import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/** Wider window to avoid misses when cron cadence drifts. */
const WINDOW_HALF_WIDTH_MIN = 40;
const REMINDER_24H_MIN = 24 * 60;
const REMINDER_2H_MIN = 2 * 60;

type AppointmentRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  starts_at: string;
  ends_at: string;
  title: string | null;
  clients: { name: string } | null;
  services: { name: string } | null;
};

type ClientRow = {
  id: string;
  telegram_chat_id: string | number;
  telegram_username: string | null;
};

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization");
  const headerSecret = req.headers.get("X-Cron-Secret");
  const authOk = auth === `Bearer ${cronSecret}`;
  const headerOk = headerSecret === cronSecret;
  if (!cronSecret || (!authOk && !headerOk)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!supabaseUrl || !serviceKey || !botToken) {
    console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or TELEGRAM_BOT_TOKEN");
    return new Response(JSON.stringify({ error: "misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const stage24h = await runReminderStage({
    supabase,
    botToken,
    leadMinutes: REMINDER_24H_MIN,
    sentAtColumn: "telegram_reminder_24h_sent_at",
    stageLabel: "24h",
  });
  if (!stage24h.ok) {
    return stage24h.response;
  }

  const stage2h = await runReminderStage({
    supabase,
    botToken,
    leadMinutes: REMINDER_2H_MIN,
    sentAtColumn: "telegram_reminder_2h_sent_at",
    stageLabel: "2h",
  });
  if (!stage2h.ok) {
    return stage2h.response;
  }

  return new Response(
    JSON.stringify({
      data: {
        sent24h: stage24h.sent,
        checked24h: stage24h.checked,
        skippedNoChat24h: stage24h.skippedNoChat,
        sendFailed24h: stage24h.sendFailed,
        markFailed24h: stage24h.markFailed,
        window24h: stage24h.window,
        sent2h: stage2h.sent,
        checked2h: stage2h.checked,
        skippedNoChat2h: stage2h.skippedNoChat,
        sendFailed2h: stage2h.sendFailed,
        markFailed2h: stage2h.markFailed,
        window2h: stage2h.window,
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

type ReminderStage = "24h" | "2h";
type ReminderSentColumn =
  | "telegram_reminder_24h_sent_at"
  | "telegram_reminder_2h_sent_at";

async function runReminderStage(params: {
  supabase: ReturnType<typeof createClient>;
  botToken: string;
  leadMinutes: number;
  sentAtColumn: ReminderSentColumn;
  stageLabel: ReminderStage;
}): Promise<
  | {
      ok: true;
      sent: number;
      checked: number;
      skippedNoChat: number;
      sendFailed: number;
      markFailed: number;
      window: { fromIso: string; toIso: string };
    }
  | { ok: false; response: Response }
> {
  const now = Date.now();
  const fromIso = new Date(
    now + (params.leadMinutes - WINDOW_HALF_WIDTH_MIN) * 60 * 1000,
  ).toISOString();
  const toIso = new Date(
    now + (params.leadMinutes + WINDOW_HALF_WIDTH_MIN) * 60 * 1000,
  ).toISOString();

  const { data: appointments, error: aptError } = await params.supabase
    .from("appointments")
    .select("id, user_id, client_id, starts_at, ends_at, title, clients(name), services(name)")
    .in("status", ["scheduled", "confirmed"])
    .is(params.sentAtColumn, null)
    .not("client_id", "is", null)
    .gte("starts_at", fromIso)
    .lte("starts_at", toIso);

  if (aptError) {
    console.error(aptError);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "appointments_query" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const list = (appointments ?? []) as AppointmentRow[];
  if (list.length === 0) {
    console.info("[telegram-reminders-cron] no appointments in window", {
      stage: params.stageLabel,
      fromIso,
      toIso,
    });
    return {
      ok: true,
      sent: 0,
      checked: 0,
      skippedNoChat: 0,
      sendFailed: 0,
      markFailed: 0,
      window: { fromIso, toIso },
    };
  }

  const clientIds = [...new Set(list.map((a) => a.client_id).filter(Boolean))] as string[];
  const { data: clients, error: clientError } = await params.supabase
    .from("clients")
    .select("id, telegram_chat_id, telegram_username")
    .in("id", clientIds)
    .not("telegram_chat_id", "is", null);

  if (clientError) {
    console.error(clientError);
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "clients_query" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const clientById = new Map(
    (clients ?? []).map((c) => [(c as ClientRow).id, c as ClientRow]),
  );

  let sent = 0;
  let skippedNoChat = 0;
  let sendFailed = 0;
  let markFailed = 0;
  for (const row of list) {
    if (!row.client_id) {
      continue;
    }
    const client = clientById.get(row.client_id);
    if (!client?.telegram_chat_id) {
      skippedNoChat += 1;
      continue;
    }

    const clientName = row.clients?.name ?? null;
    const serviceName = row.services?.name ?? null;
    const startsAt = new Date(row.starts_at);
    const whenLabel = startsAt.toLocaleString("uk-UA", {
      timeZone: "Europe/Kyiv",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const leadText =
      params.stageLabel === "24h"
        ? "Нагадування від Plurio: ваш запис завтра."
        : "Нагадування від Plurio: ваш запис через ~2 години.";
    const lines = [leadText, `Час: ${whenLabel}`];
    if (row.title) {
      lines.push(`Назва: ${row.title}`);
    }
    if (clientName) {
      lines.push(`Ім'я: ${clientName}`);
    }
    if (serviceName) {
      lines.push(`Послуга: ${serviceName}`);
    }
    const text = lines.join("\n");

    const tgRes = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: client.telegram_chat_id,
        text,
      }),
    });

    if (!tgRes.ok) {
      console.error("Telegram send failed", row.id, await tgRes.text());
      sendFailed += 1;
      continue;
    }

    const sentAt = new Date().toISOString();
    const { error: updError } = await params.supabase
      .from("appointments")
      .update({
        [params.sentAtColumn]: sentAt,
      })
      .eq("id", row.id);

    if (!updError) {
      sent += 1;
    } else {
      console.error("Failed to mark reminder sent", row.id, updError);
      markFailed += 1;
    }
  }

  const summary = {
    stage: params.stageLabel,
    fromIso,
    toIso,
    checked: list.length,
    sent,
    skippedNoChat,
    sendFailed,
    markFailed,
  };
  console.info("[telegram-reminders-cron] stage summary", summary);

  return {
    ok: true,
    sent,
    checked: list.length,
    skippedNoChat,
    sendFailed,
    markFailed,
    window: { fromIso, toIso },
  };
}

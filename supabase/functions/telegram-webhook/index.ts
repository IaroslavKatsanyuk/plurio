import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 21;
const SLOT_STEP_MINUTES = 15;
const TWO_MONTHS_DAYS = 62;

/** Reply keyboard: must match handler in handlePlainTextForClient */
const MENU_BTN_BOOK = "Запис";
const MENU_BTN_MY_APPOINTMENTS = "Мої записи";

type TelegramChat = { id: number };
type TelegramMessage = { message_id: number; text?: string; chat: TelegramChat };
type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: TelegramMessage;
};
type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type ClientContext = {
  id: string;
  name: string | null;
  user_id: string;
};

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
};

type AppointmentRangeRow = {
  starts_at: string;
  ends_at: string;
};

type InlineKeyboardButton = {
  text: string;
  callback_data: string;
};

type ReplyKeyboardMarkup = {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard: boolean;
  one_time_keyboard: boolean;
};

type AppointmentListRow = {
  starts_at: string;
  title: string | null;
  status: string;
  services: { name: string } | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (webhookSecret) {
    const header = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (header !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const message = update.message ?? update.edited_message;
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfiguration", { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  if (update.callback_query) {
    await handleCallbackQuery({ botToken, supabase, callback: update.callback_query });
    return jsonOk();
  }

  const rawText = message?.text?.trim();
  if (!rawText || !message) {
    return jsonOk();
  }
  const chatId = message.chat.id;

  if (rawText.startsWith("/start")) {
    const token = rawText.split(/\s+/)[1];

    if (!token) {
      const ctx = await getClientContextByChatId(supabase, chatId);
      if (ctx) {
        await sendBotMessage(
          botToken,
          chatId,
          "Обери дію в меню нижче.",
          clientMainMenuKeyboard(),
        );
      } else {
        await sendBotMessage(
          botToken,
          chatId,
          "Щоб підключити Telegram, відкрий персональне посилання від майстра.",
        );
      }
      return jsonOk();
    }

    const { data: linked, error } = await supabase
      .from("clients")
      .update({ telegram_chat_id: chatId, telegram_link_token: null })
      .eq("telegram_link_token", token)
      .select("id, name")
      .maybeSingle();

    if (error) {
      console.error(error);
      await sendBotMessage(botToken, chatId, "Тимчасова помилка. Спробуй ще раз пізніше.");
      return jsonOk();
    }

    if (!linked) {
      await sendBotMessage(
        botToken,
        chatId,
        "Посилання недійсне або застаріле. Попроси майстра згенерувати нове запрошення.",
      );
      return jsonOk();
    }

    const clientName = (linked as { name?: string } | null)?.name?.trim();
    await sendBotMessage(
      botToken,
      chatId,
      clientName
        ? `Готово, ${clientName}. Telegram підключено. Отримаєш підтвердження запису та нагадування за ~2 год до візиту.`
        : "Готово. Telegram підключено. Отримаєш підтвердження запису та нагадування за ~2 год до візиту.",
      clientMainMenuKeyboard(),
    );
    return jsonOk();
  }

  await handlePlainTextForClient({ botToken, supabase, chatId, text: rawText });
  return jsonOk();
});

function jsonOk(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function clientMainMenuKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: MENU_BTN_BOOK }, { text: MENU_BTN_MY_APPOINTMENTS }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function isBookMenuAction(text: string): boolean {
  const t = text.trim();
  if (t === MENU_BTN_BOOK) return true;
  const low = t.toLowerCase();
  return low === "/book";
}

function isMyAppointmentsMenuAction(text: string): boolean {
  const t = text.trim();
  if (t === MENU_BTN_MY_APPOINTMENTS) return true;
  const low = t.toLowerCase();
  return low === "/my" || low === "/appointments";
}

async function handlePlainTextForClient(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  text: string;
}) {
  const { botToken, supabase, chatId, text } = params;
  const ctx = await getClientContextByChatId(supabase, chatId);

  if (isBookMenuAction(text)) {
    if (!ctx) {
      await sendBotMessage(
        botToken,
        chatId,
        "Спочатку підключи Telegram через персональне посилання від майстра.",
      );
      return;
    }
    await showServicePicker({ botToken, supabase, chatId });
    return;
  }

  if (isMyAppointmentsMenuAction(text)) {
    if (!ctx) {
      await sendBotMessage(
        botToken,
        chatId,
        "Спочатку підключи Telegram через персональне посилання від майстра.",
      );
      return;
    }
    await sendUpcomingAppointmentsMessage({ botToken, supabase, chatId, clientId: ctx.id });
    return;
  }

  if (ctx) {
    await sendBotMessage(
      botToken,
      chatId,
      "Обери пункт у меню внизу: «Запис» або «Мої записи».",
      clientMainMenuKeyboard(),
    );
    return;
  }

  await sendBotMessage(
    botToken,
    chatId,
    "Щоб користуватися ботом, відкрий персональне посилання від майстра (через /start з кодом).",
  );
}

function appointmentStatusLabelUa(status: string): string {
  if (status === "scheduled") return "заплановано";
  if (status === "confirmed") return "підтверджено";
  if (status === "cancelled") return "скасовано";
  if (status === "completed") return "завершено";
  return status;
}

function formatKyivDateTime(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

async function sendUpcomingAppointmentsMessage(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  clientId: string;
}) {
  const { botToken, supabase, chatId, clientId } = params;
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("appointments")
    .select("starts_at, title, status, services(name)")
    .eq("client_id", clientId)
    .in("status", ["scheduled", "confirmed"])
    .gt("ends_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(25);

  if (error) {
    console.error("Failed to load client appointments", error);
    await sendBotMessage(
      botToken,
      chatId,
      "Не вдалося завантажити записи. Спробуй пізніше.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const list = (rows ?? []) as AppointmentListRow[];
  if (list.length === 0) {
    await sendBotMessage(
      botToken,
      chatId,
      "Активних майбутніх записів немає. Натисни «Запис», щоб обрати послугу.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const lines = list.map((row) => {
    const svc = row.services?.name?.trim();
    const label = svc || row.title?.trim() || "Запис";
    const st = appointmentStatusLabelUa(row.status);
    return `• ${formatKyivDateTime(row.starts_at)} — ${label} (${st})`;
  });

  const text = ["Твої майбутні записи:", "", ...lines].join("\n");
  await sendBotMessage(botToken, chatId, text, clientMainMenuKeyboard());
}

async function handleCallbackQuery(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  callback: TelegramCallbackQuery;
}) {
  const { callback, botToken, supabase } = params;
  if (!callback.id || !callback.message?.chat.id) {
    return;
  }

  await answerCallbackQuery(botToken, callback.id);
  const chatId = callback.message.chat.id;
  const data = callback.data?.trim() ?? "";

  if (data === "book:start") {
    await showServicePicker({ botToken, supabase, chatId });
    return;
  }

  if (data === "appt:list") {
    const ctx = await getClientContextByChatId(supabase, chatId);
    if (!ctx) {
      await sendBotMessage(
        botToken,
        chatId,
        "Підключення Telegram не знайдено. Відкрий персональне посилання від майстра ще раз.",
      );
      return;
    }
    await sendUpcomingAppointmentsMessage({ botToken, supabase, chatId, clientId: ctx.id });
    return;
  }

  if (data.startsWith("svc:")) {
    const serviceId = data.slice(4).trim();
    if (!serviceId) {
      await sendBotMessage(botToken, chatId, "Не вдалося визначити послугу. Спробуй ще раз.");
      return;
    }
    await sendAvailableDates({ botToken, supabase, chatId, serviceId });
  }
}

async function showServicePicker(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
}) {
  const { botToken, supabase, chatId } = params;
  const ctx = await getClientContextByChatId(supabase, chatId);
  if (!ctx) {
    await sendBotMessage(
      botToken,
      chatId,
      "Спочатку підключи Telegram через персональне посилання від майстра, а потім повтори.",
    );
    return;
  }

  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("user_id", ctx.user_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load services", error);
    await sendBotMessage(botToken, chatId, "Не вдалося завантажити послуги. Спробуй трохи пізніше.");
    return;
  }

  const list = (services ?? []) as ServiceRow[];
  if (list.length === 0) {
    await sendBotMessage(botToken, chatId, "Зараз немає доступних послуг для онлайн-запису.");
    return;
  }

  const keyboard: InlineKeyboardButton[][] = list
    .slice(0, 20)
    .map((service) => [
      {
        text: `${service.name} (${service.duration_minutes} хв)`,
        callback_data: `svc:${service.id}`,
      },
    ]);

  const inlineKeyboard: InlineKeyboardButton[][] = [
    ...keyboard,
    [{ text: "Мої записи", callback_data: "appt:list" }],
  ];

  await sendBotMessage(
    botToken,
    chatId,
    "Обери послугу, і я покажу доступні дати на найближчі 2 місяці:",
    { inline_keyboard: inlineKeyboard },
  );
}

async function sendAvailableDates(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  serviceId: string;
}) {
  const { botToken, supabase, chatId, serviceId } = params;
  const ctx = await getClientContextByChatId(supabase, chatId);
  if (!ctx) {
    await sendBotMessage(
      botToken,
      chatId,
      "Підключення Telegram не знайдено. Відкрий персональне посилання від майстра ще раз.",
    );
    return;
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("user_id", ctx.user_id)
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceError || !service) {
    await sendBotMessage(botToken, chatId, "Послуга недоступна. Обери іншу.");
    return;
  }

  const now = new Date();
  const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rangeEnd = new Date(rangeStart.getTime() + TWO_MONTHS_DAYS * 24 * 60 * 60 * 1000);

  const { data: rows, error: aptError } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("user_id", ctx.user_id)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());

  if (aptError) {
    console.error("Failed to load appointments", aptError);
    await sendBotMessage(botToken, chatId, "Не вдалося завантажити зайнятість. Спробуй пізніше.");
    return;
  }

  const busy = ((rows ?? []) as AppointmentRangeRow[]).map((row) => ({
    s: new Date(row.starts_at).getTime(),
    e: new Date(row.ends_at).getTime(),
  }));

  const durationMs = (service as ServiceRow).duration_minutes * 60 * 1000;
  const availableDates: string[] = [];
  for (let i = 0; i < TWO_MONTHS_DAYS; i += 1) {
    const dayStartMs = rangeStart.getTime() + i * 24 * 60 * 60 * 1000;
    if (hasAnySlotForDay(dayStartMs, durationMs, busy)) {
      availableDates.push(formatKyivDate(dayStartMs));
    }
  }

  if (availableDates.length === 0) {
    await sendBotMessage(
      botToken,
      chatId,
      `На жаль, на найближчі 2 місяці для "${(service as ServiceRow).name}" вільних дат немає.`,
      {
        inline_keyboard: [
          [
            { text: "Обрати іншу послугу", callback_data: "book:start" },
            { text: "Мої записи", callback_data: "appt:list" },
          ],
        ],
      },
    );
    return;
  }

  const text = [
    `Доступні дати на 2 місяці для "${(service as ServiceRow).name}":`,
    availableDates.map((d) => `- ${d}`).join("\n"),
    "",
    "Щоб забронювати конкретний час, напиши майстру або обери іншу послугу.",
  ].join("\n");

  await sendBotMessage(botToken, chatId, text, {
    inline_keyboard: [
      [
        { text: "Інша послуга", callback_data: "book:start" },
        { text: "Мої записи", callback_data: "appt:list" },
      ],
    ],
  });
}

function hasAnySlotForDay(dayStartMs: number, durationMs: number, busy: Array<{ s: number; e: number }>): boolean {
  const workOpen = dayStartMs + WORK_DAY_START_HOUR * 60 * 60 * 1000;
  const workClose = dayStartMs + WORK_DAY_END_HOUR * 60 * 60 * 1000;
  const stepMs = SLOT_STEP_MINUTES * 60 * 1000;

  for (let t = workOpen; t + durationMs <= workClose; t += stepMs) {
    const slotEnd = t + durationMs;
    let collides = false;
    for (const b of busy) {
      if (t < b.e && slotEnd > b.s) {
        collides = true;
        break;
      }
    }
    if (!collides) {
      return true;
    }
  }

  return false;
}

function formatKyivDate(timestampMs: number): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestampMs));
}

async function getClientContextByChatId(
  supabase: ReturnType<typeof createClient>,
  chatId: number,
): Promise<ClientContext | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, user_id")
    .eq("telegram_chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id || !data.user_id) {
    return null;
  }

  return {
    id: data.id as string,
    name: (data.name as string | null) ?? null,
    user_id: data.user_id as string,
  };
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string) {
  await fetch(`${TELEGRAM_API}/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

async function sendBotMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: ReplyKeyboardMarkup | { inline_keyboard: InlineKeyboardButton[][] },
) {
  const payload: Record<string, unknown> = { chat_id: chatId, text };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

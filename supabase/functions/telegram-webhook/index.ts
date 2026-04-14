import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

import {
  computeSlotStartsForWorkDay,
  daysInMonth,
  DEFAULT_BOOKING_TIMEZONE,
  getWeekdayKeyAtUtcMs,
  hasAnyBookableSlotInZonedBookingMonths,
  isAppointmentWithinWorkSchedule,
  isValidIanaTimezone,
  legacyDefaultSchedule,
  normalizeProfileWeeklySchedule,
  nextThreeZonedYearMonths,
  type WorkWeeklySchedule,
  zonedThreeMonthBusyRangeUtc,
  zonedWallMidnightUtcMs,
  zonedTodayYmd,
} from "./work-schedule.ts";

const TELEGRAM_API = "https://api.telegram.org";
const SLOT_STEP_MINUTES = 15;

/** Inline callback prefixes (Telegram callback_data max 64 bytes; UUID = 36 chars). */
const CB_MONTH = "mn:";
const CB_DAY = "dy:";
const CB_SLOT = "sl:";
const CB_YES = "y:";
const CB_NO = "n";

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

async function loadOwnerBookingWork(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ tz: string; schedule: WorkWeeklySchedule }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("booking_timezone, work_weekly_schedule")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { tz: DEFAULT_BOOKING_TIMEZONE, schedule: legacyDefaultSchedule() };
  }
  const row = data as {
    booking_timezone?: string | null;
    work_weekly_schedule?: unknown | null;
  };
  const rawTz = row.booking_timezone?.trim() || DEFAULT_BOOKING_TIMEZONE;
  const tz = isValidIanaTimezone(rawTz) ? rawTz : DEFAULT_BOOKING_TIMEZONE;
  return {
    tz,
    schedule: normalizeProfileWeeklySchedule(row.work_weekly_schedule),
  };
}

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

function isMenuHelpCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "/menu" || t === "/help";
}

async function handlePlainTextForClient(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  text: string;
}) {
  const { botToken, supabase, chatId, text } = params;
  const ctx = await getClientContextByChatId(supabase, chatId);

  if (isMenuHelpCommand(text)) {
    if (!ctx) {
      await sendBotMessage(
        botToken,
        chatId,
        "Спочатку підключи Telegram через персональне посилання від майстра.",
      );
      return;
    }
    await sendBotMessage(
      botToken,
      chatId,
      "Нижче кнопки: «Запис» — послуга, місяць, день і час; «Мої записи» — що вже заплановано.",
      clientMainMenuKeyboard(),
    );
    return;
  }

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

function formatZonedDateTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatZonedShortDay(timestampMs: number, tz: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestampMs));
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

  const { data: clientOwner } = await supabase
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();
  const ownerUserId = clientOwner?.user_id as string | undefined;
  const ownerTz = ownerUserId
    ? (await loadOwnerBookingWork(supabase, ownerUserId)).tz
    : DEFAULT_BOOKING_TIMEZONE;

  const lines = list.map((row) => {
    const svc = row.services?.name?.trim();
    const label = svc || row.title?.trim() || "Запис";
    const st = appointmentStatusLabelUa(row.status);
    return `• ${formatZonedDateTime(row.starts_at, ownerTz)} — ${label} (${st})`;
  });

  const text = ["Твої майбутні записи:", "", ...lines].join("\n");
  await sendBotMessage(botToken, chatId, text, clientMainMenuKeyboard());
}

function parsePrefixedUuidRest(
  data: string,
  prefix: string,
): { serviceId: string; rest: string } | null {
  if (!data.startsWith(prefix)) {
    return null;
  }
  const body = data.slice(prefix.length);
  if (body.length < 38 || body[36] !== ":") {
    return null;
  }
  const serviceId = body.slice(0, 36);
  const rest = body.slice(37);
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
    return null;
  }
  return { serviceId, rest };
}

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

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function isYmdBeforeTodayInZone(ymd: string, tz: string): boolean {
  const p = parseYmd(ymd);
  if (!p) return true;
  const t = zonedTodayYmd(tz);
  const a = p.y * 10000 + p.m * 100 + p.d;
  const b = t.y * 10000 + t.m * 100 + t.d;
  return a < b;
}

function isYmdInBookingWindow(ymd: string, tz: string): boolean {
  const p = parseYmd(ymd);
  if (!p) return false;
  const allowed = nextThreeZonedYearMonths(tz);
  const ym = ymd.slice(0, 7);
  return allowed.includes(ym);
}

function monthTitleUk(ym: string): string {
  const parts = ym.split("-");
  if (parts.length !== 2) {
    return ym;
  }
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    return ym;
  }
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

async function loadBusyAppointments(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<Array<{ s: number; e: number }>> {
  const { data: rows, error } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("user_id", userId)
    .in("status", ["scheduled", "confirmed"])
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso);

  if (error) {
    console.error("loadBusyAppointments", error);
    return [];
  }
  return ((rows ?? []) as AppointmentRangeRow[]).map((row) => ({
    s: new Date(row.starts_at).getTime(),
    e: new Date(row.ends_at).getTime(),
  }));
}

async function appointmentOverlapExists(params: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  startsIso: string;
  endsIso: string;
}): Promise<boolean> {
  const { data, error } = await params.supabase
    .from("appointments")
    .select("id")
    .eq("user_id", params.userId)
    .in("status", ["scheduled", "confirmed"])
    .lt("starts_at", params.endsIso)
    .gt("ends_at", params.startsIso)
    .limit(1);
  if (error) {
    return true;
  }
  return (data ?? []).length > 0;
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

  if (data === CB_NO) {
    await sendBotMessage(
      botToken,
      chatId,
      "Добре, запис не створено.",
      clientMainMenuKeyboard(),
    );
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

  const yesParsed = parsePrefixedUuidRest(data, CB_YES);
  if (yesParsed) {
    const startMs = Number(yesParsed.rest);
    if (!Number.isFinite(startMs)) {
      await sendBotMessage(botToken, chatId, "Некоректний час. Почни запис спочатку: «Запис».");
      return;
    }
    await confirmTelegramBooking({
      botToken,
      supabase,
      chatId,
      serviceId: yesParsed.serviceId,
      startMs,
    });
    return;
  }

  const slotParsed = parsePrefixedUuidRest(data, CB_SLOT);
  if (slotParsed) {
    const startMs = Number(slotParsed.rest);
    if (!Number.isFinite(startMs)) {
      await sendBotMessage(botToken, chatId, "Некоректний час. Обери слот ще раз.");
      return;
    }
    await promptBookingConfirm({
      botToken,
      supabase,
      chatId,
      serviceId: slotParsed.serviceId,
      startMs,
    });
    return;
  }

  const dayParsed = parsePrefixedUuidRest(data, CB_DAY);
  if (dayParsed) {
    const ymd = dayParsed.rest;
    if (!parseYmd(ymd)) {
      await sendBotMessage(botToken, chatId, "Некоректна дата. Обери день знову.");
      return;
    }
    const dayCtx = await getClientContextByChatId(supabase, chatId);
    if (!dayCtx) {
      await sendBotMessage(
        botToken,
        chatId,
        "Підключення Telegram не знайдено. Відкрий персональне посилання від майстра ще раз.",
      );
      return;
    }
    const dayOwnerBook = await loadOwnerBookingWork(supabase, dayCtx.user_id);
    if (!isYmdInBookingWindow(ymd, dayOwnerBook.tz)) {
      await sendBotMessage(
        botToken,
        chatId,
        "Ця дата вже недоступна для запису. Обери «Запис» знову.",
      );
      return;
    }
    await sendSlotsKeyboard({
      botToken,
      supabase,
      chatId,
      serviceId: dayParsed.serviceId,
      localYmd: ymd,
    });
    return;
  }

  const monthParsed = parsePrefixedUuidRest(data, CB_MONTH);
  if (monthParsed) {
    if (!/^\d{4}-\d{2}$/.test(monthParsed.rest)) {
      await sendBotMessage(botToken, chatId, "Некоректний місяць. Почни з «Запис».");
      return;
    }
    await sendDaysForMonthKeyboard({
      botToken,
      supabase,
      chatId,
      serviceId: monthParsed.serviceId,
      yearMonth: monthParsed.rest,
    });
    return;
  }

  if (data.startsWith("svc:")) {
    const serviceId = data.slice(4).trim();
    if (!serviceId) {
      await sendBotMessage(botToken, chatId, "Не вдалося визначити послугу. Спробуй ще раз.");
      return;
    }
    await sendMonthPickerForService({ botToken, supabase, chatId, serviceId });
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
    await sendBotMessage(botToken, chatId, "Зараз немає доступних послуг для запису через бота.");
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
    "Обери послугу, далі — місяць, день і час для запису:",
    { inline_keyboard: inlineKeyboard },
  );
}

async function sendMonthPickerForService(params: {
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

  const ownerBook = await loadOwnerBookingWork(supabase, ctx.user_id);
  const { startMs, endMs } = zonedThreeMonthBusyRangeUtc(ownerBook.tz);
  const busy = await loadBusyAppointments(
    supabase,
    ctx.user_id,
    new Date(startMs).toISOString(),
    new Date(endMs).toISOString(),
  );

  const durationMs = (service as ServiceRow).duration_minutes * 60 * 1000;
  const nowUtc = Date.now();
  if (
    !hasAnyBookableSlotInZonedBookingMonths({
      tz: ownerBook.tz,
      durationMs,
      busy,
      schedule: ownerBook.schedule,
      slotStepMinutes: SLOT_STEP_MINUTES,
      nowUtcMs: nowUtc,
    })
  ) {
    const emptyKb: InlineKeyboardButton[][] = [
      [
        { text: "Обрати іншу послугу", callback_data: "book:start" },
        { text: "Мої записи", callback_data: "appt:list" },
      ],
    ];
    await sendBotMessage(
      botToken,
      chatId,
      `На жаль, у найближчі 3 місяці (поточний + 2) для «${(service as ServiceRow).name}» вільних вікон немає.`,
      { inline_keyboard: emptyKb },
    );
    return;
  }

  const sortedMonths = nextThreeZonedYearMonths(ownerBook.tz);
  const monthRows: InlineKeyboardButton[][] = [];
  let row: InlineKeyboardButton[] = [];
  for (const ym of sortedMonths) {
    row.push({
      text: monthTitleUk(ym),
      callback_data: `${CB_MONTH}${serviceId}:${ym}`,
    });
    if (row.length >= 2) {
      monthRows.push(row);
      row = [];
    }
  }
  if (row.length) {
    monthRows.push(row);
  }

  const inlineKeyboard: InlineKeyboardButton[][] = [
    ...monthRows,
    [
      { text: "Інша послуга", callback_data: "book:start" },
      { text: "Мої записи", callback_data: "appt:list" },
    ],
  ];

  await sendBotMessage(
    botToken,
    chatId,
    `Обери місяць для «${(service as ServiceRow).name}» (поточний і ще 2 місяці, час — ${ownerBook.tz}):`,
    { inline_keyboard: inlineKeyboard },
  );
}

async function sendDaysForMonthKeyboard(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  serviceId: string;
  yearMonth: string;
}) {
  const { botToken, supabase, chatId, serviceId, yearMonth } = params;
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

  const monthOwnerBook = await loadOwnerBookingWork(supabase, ctx.user_id);
  if (!nextThreeZonedYearMonths(monthOwnerBook.tz).includes(yearMonth)) {
    await sendBotMessage(
      botToken,
      chatId,
      "Цей місяць уже недоступний. Обери «Запис» знову.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const [ys, ms] = yearMonth.split("-").map(Number);
  const dim = daysInMonth(ys, ms);

  const dayRows: InlineKeyboardButton[][] = [];
  let dRow: InlineKeyboardButton[] = [];
  for (let day = 1; day <= dim; day += 1) {
    const ymd = `${yearMonth}-${String(day).padStart(2, "0")}`;
    dRow.push({
      text: String(day),
      callback_data: `${CB_DAY}${serviceId}:${ymd}`,
    });
    if (dRow.length >= 7) {
      dayRows.push(dRow);
      dRow = [];
    }
  }
  if (dRow.length) {
    dayRows.push(dRow);
  }

  const inlineKeyboard: InlineKeyboardButton[][] = [
    ...dayRows,
    [
      { text: "Назад: місяці", callback_data: `svc:${serviceId}` },
      { text: "Мої записи", callback_data: "appt:list" },
    ],
  ];

  await sendBotMessage(
    botToken,
    chatId,
    `Обери день — ${monthTitleUk(yearMonth)} (усі дні місяця). Послуга «${(service as ServiceRow).name}». Минуле — не для запису.`,
    { inline_keyboard: inlineKeyboard },
  );
}

async function sendSlotsKeyboard(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  serviceId: string;
  localYmd: string;
}) {
  const { botToken, supabase, chatId, serviceId, localYmd } = params;
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

  const slotOwnerBook = await loadOwnerBookingWork(supabase, ctx.user_id);

  if (!parseYmd(localYmd) || !isYmdInBookingWindow(localYmd, slotOwnerBook.tz)) {
    await sendBotMessage(
      botToken,
      chatId,
      "Дата недоступна. Обери день з календаря знову.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  if (isYmdBeforeTodayInZone(localYmd, slotOwnerBook.tz)) {
    await sendBotMessage(
      botToken,
      chatId,
      "Цей день уже минув. Обери сьогоднішню або майбутню дату.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const ymdParts = parseYmd(localYmd)!;
  const dayStartMs = zonedWallMidnightUtcMs(
    ymdParts.y,
    ymdParts.m,
    ymdParts.d,
    slotOwnerBook.tz,
  );

  const { startMs, endMs } = zonedThreeMonthBusyRangeUtc(slotOwnerBook.tz);
  const busy = await loadBusyAppointments(
    supabase,
    ctx.user_id,
    new Date(startMs).toISOString(),
    new Date(endMs).toISOString(),
  );
  const durationMs = (service as ServiceRow).duration_minutes * 60 * 1000;
  const weekday = getWeekdayKeyAtUtcMs(dayStartMs, slotOwnerBook.tz);
  if (!weekday) {
    await sendBotMessage(botToken, chatId, "Не вдалося визначити день тижня. Спробуй іншу дату.");
    return;
  }
  const slotStarts = computeSlotStartsForWorkDay({
    dayStartUtcMs: dayStartMs,
    durationMs,
    busy,
    schedule: slotOwnerBook.schedule,
    weekday,
    slotStepMinutes: SLOT_STEP_MINUTES,
    nowUtcMs: Date.now(),
  });

  if (slotStarts.length === 0) {
    await sendBotMessage(
      botToken,
      chatId,
      "На цей день вільних годин немає. Обери інший день.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const timeFmt = new Intl.DateTimeFormat("uk-UA", {
    timeZone: slotOwnerBook.tz,
    hour: "2-digit",
    minute: "2-digit",
  });

  const slotRows: InlineKeyboardButton[][] = [];
  let sRow: InlineKeyboardButton[] = [];
  for (const t of slotStarts) {
    sRow.push({
      text: timeFmt.format(new Date(t)),
      callback_data: `${CB_SLOT}${serviceId}:${t}`,
    });
    if (sRow.length >= 4) {
      slotRows.push(sRow);
      sRow = [];
    }
  }
  if (sRow.length) {
    slotRows.push(sRow);
  }

  const ym = localYmd.slice(0, 7);
  const inlineKeyboard: InlineKeyboardButton[][] = [
    ...slotRows,
    [
      { text: "Назад: дні", callback_data: `${CB_MONTH}${serviceId}:${ym}` },
      { text: "Мої записи", callback_data: "appt:list" },
    ],
  ];

  await sendBotMessage(
    botToken,
    chatId,
    `Обери час для «${(service as ServiceRow).name}» (${formatZonedShortDay(dayStartMs, slotOwnerBook.tz)}):`,
    { inline_keyboard: inlineKeyboard },
  );
}

async function promptBookingConfirm(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  serviceId: string;
  startMs: number;
}) {
  const { botToken, supabase, chatId, serviceId, startMs } = params;
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
    await sendBotMessage(botToken, chatId, "Послуга недоступна. Почни з «Запис».");
    return;
  }

  const promptOwnerBook = await loadOwnerBookingWork(supabase, ctx.user_id);
  const svcRow = service as ServiceRow;
  const startsIsoProbe = new Date(startMs).toISOString();
  const endsIsoProbe = new Date(
    startMs + svcRow.duration_minutes * 60 * 1000,
  ).toISOString();
  if (
    !isAppointmentWithinWorkSchedule(
      startsIsoProbe,
      endsIsoProbe,
      promptOwnerBook.tz,
      promptOwnerBook.schedule,
    )
  ) {
    await sendBotMessage(
      botToken,
      chatId,
      "Цей час уже поза робочим графіком майстра. Обери інший слот через «Запис».",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const whenLabel = formatZonedDateTime(startsIsoProbe, promptOwnerBook.tz);
  const svcName = svcRow.name;
  const yesData = `${CB_YES}${serviceId}:${startMs}`;

  await sendBotMessage(botToken, chatId, `Підтвердити запис?\n\n${svcName}\n${whenLabel}`, {
    inline_keyboard: [
      [
        { text: "Так", callback_data: yesData },
        { text: "Ні", callback_data: CB_NO },
      ],
    ],
  });
}

async function confirmTelegramBooking(params: {
  botToken: string;
  supabase: ReturnType<typeof createClient>;
  chatId: number;
  serviceId: string;
  startMs: number;
}) {
  const { botToken, supabase, chatId, serviceId, startMs } = params;
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
    await sendBotMessage(botToken, chatId, "Послуга недоступна. Почни з «Запис».");
    return;
  }

  const svc = service as ServiceRow;
  const startsAt = new Date(startMs);
  if (!Number.isFinite(startsAt.getTime())) {
    await sendBotMessage(botToken, chatId, "Некоректний час. Почни з «Запис».");
    return;
  }

  const startsIso = startsAt.toISOString();
  const endsIso = new Date(startMs + svc.duration_minutes * 60 * 1000).toISOString();

  const confirmOwnerBook = await loadOwnerBookingWork(supabase, ctx.user_id);
  if (
    !isAppointmentWithinWorkSchedule(
      startsIso,
      endsIso,
      confirmOwnerBook.tz,
      confirmOwnerBook.schedule,
    )
  ) {
    await sendBotMessage(
      botToken,
      chatId,
      "Цей час уже поза робочим графіком. Обери інший слот через «Запис».",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const overlap = await appointmentOverlapExists({
    supabase,
    userId: ctx.user_id,
    startsIso,
    endsIso,
  });
  if (overlap) {
    await sendBotMessage(
      botToken,
      chatId,
      "Цей час щойно зайняли. Обери інший слот через «Запис».",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const clientName = ctx.name?.trim() ?? "Клієнт";
  const title = `Запис: ${clientName}`.slice(0, 200);

  const { data: created, error: insErr } = await supabase
    .from("appointments")
    .insert({
      user_id: ctx.user_id,
      client_id: ctx.id,
      service_id: svc.id,
      title,
      starts_at: startsIso,
      ends_at: endsIso,
      status: "scheduled",
      notes: "Запис у Telegram-боті",
    })
    .select("id")
    .single();

  if (insErr || !created?.id) {
    console.error("Telegram booking insert failed", insErr);
    await sendBotMessage(
      botToken,
      chatId,
      "Не вдалося створити запис. Спробуй ще раз або напиши майстру.",
      clientMainMenuKeyboard(),
    );
    return;
  }

  const appointmentId = created.id as string;

  const { error: inboxErr } = await supabase.from("owner_inbox_events").insert({
    user_id: ctx.user_id,
    kind: "telegram_booking",
    appointment_id: appointmentId,
  });
  if (inboxErr) {
    console.error("owner_inbox_events insert failed", inboxErr);
  }

  const whenLabel = formatZonedDateTime(startsIso, confirmOwnerBook.tz);

  const clientLines = ["Plurio: запис підтверджено.", `Час: ${whenLabel}`, `Послуга: ${svc.name}`];
  if (ctx.name?.trim()) {
    clientLines.push(`Ім'я: ${ctx.name.trim()}`);
  }
  await sendBotMessage(botToken, chatId, clientLines.join("\n"), clientMainMenuKeyboard());

  const sentAt = new Date().toISOString();
  await supabase
    .from("appointments")
    .update({ telegram_reminder_24h_sent_at: sentAt })
    .eq("id", appointmentId);

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("telegram_chat_id, display_name")
    .eq("user_id", ctx.user_id)
    .maybeSingle();

  const ownerChat = normalizeChatIdForTelegramApi(
    (ownerProfile as { telegram_chat_id?: string | number | null } | null)?.telegram_chat_id,
  );
  if (ownerChat != null) {
    const ownerMsg = [
      "Plurio: новий запис через Telegram.",
      `Клієнт: ${clientName}`,
      `Послуга: ${svc.name}`,
      `Час: ${whenLabel}`,
    ].join("\n");
    await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ownerChat, text: ownerMsg }),
    });
  }
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

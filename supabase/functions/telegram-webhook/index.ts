import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramChat = { id: number };
type TelegramMessage = { text?: string; chat: TelegramChat };
type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
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
  const rawText = message?.text?.trim();
  if (!rawText?.startsWith("/start")) {
    return jsonOk();
  }

  const token = rawText.split(/\s+/)[1];
  const chatId = message!.chat.id;

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return new Response("Server misconfiguration", { status: 500 });
  }

  if (!token) {
    await sendBotMessage(
      botToken,
      chatId,
      "Щоб підключити нагадування, відкрий персональне посилання, яке надіслав майстер.",
    );
    return jsonOk();
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

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
      ? `Готово, ${clientName}. Ти отримуватимеш нагадування про записи (~за годину до початку).`
      : "Готово. Ти отримуватимеш нагадування про записи (~за годину до початку).",
  );
  return jsonOk();
});

function jsonOk(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendBotMessage(botToken: string, chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

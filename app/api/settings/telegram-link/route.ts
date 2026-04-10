import { issueTelegramLinkToken } from "@/services/profile.service";
import { getTelegramBotUsername } from "@/lib/telegram-env";

export const dynamic = "force-dynamic";

/**
 * Генерує посилання для підключення Telegram-бота (одноразовий start-параметр).
 */
export async function POST() {
  const bot = getTelegramBotUsername();
  if (!bot) {
    return Response.json(
      {
        error: {
          code: "CONFIG",
          message:
            "Не налаштовано TELEGRAM_BOT_USERNAME у середовищі сервера (без @).",
        },
      },
      { status: 503 },
    );
  }

  const result = await issueTelegramLinkToken();
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  const deepLink = `https://t.me/${bot}?start=${result.data.token}`;
  return Response.json({ data: { deepLink } });
}

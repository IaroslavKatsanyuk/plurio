import { getTelegramBotUsername } from "@/lib/telegram-env";
import { issueClientTelegramLinkToken } from "@/services/client.service";

export const dynamic = "force-dynamic";

/**
 * Генерує персональне Telegram-посилання для клієнта.
 */
export async function POST(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  const result = await issueClientTelegramLinkToken(id);
  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED"
        ? 401
        : result.error.code === "CLIENT_NOT_FOUND"
          ? 404
          : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  const deepLink = `https://t.me/${bot}?start=${result.data.token}`;
  return Response.json({ data: { deepLink } });
}

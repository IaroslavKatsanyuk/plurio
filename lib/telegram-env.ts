/**
 * Ім'я бота без @ для deep link (змінна середовища на сервері Next.js).
 */
export function getTelegramBotUsername(): string | null {
  const raw = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/^@/, "");
}

/** Чи задано токен на сервері застосунку (Vercel тощо), без витоку значення. */
export function isTelegramBotTokenConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

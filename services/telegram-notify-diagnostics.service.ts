import {
  getTelegramBotUsername,
  isTelegramBotTokenConfigured,
} from "@/lib/telegram-env";
import { getAuthenticatedContext } from "./session";
import type { ServiceResult } from "./types";

export type TelegramNotifyDiagnostics = {
  hostingEnv: {
    botTokenConfigured: boolean;
    botUsernameConfigured: boolean;
  };
  client?: {
    id: string;
    telegramLinked: boolean;
    telegramUsernameSet: boolean;
  };
  /** Підказки українською для швидкої перевірки (без секретів). */
  hints: string[];
};

function telegramLinkedFromRow(
  chatId: string | number | null | undefined,
): boolean {
  if (chatId == null || chatId === "") {
    return false;
  }
  if (typeof chatId === "number" && chatId === 0) {
    return false;
  }
  if (typeof chatId === "string" && chatId.trim() === "0") {
    return false;
  }
  return true;
}

function buildHints(d: TelegramNotifyDiagnostics): string[] {
  const hints: string[] = [];
  if (!d.hostingEnv.botTokenConfigured) {
    hints.push(
      "У середовищі Next.js (наприклад Vercel → Settings → Environment Variables) немає TELEGRAM_BOT_TOKEN — миттєві повідомлення після запису не відправляються.",
    );
  }
  if (!d.hostingEnv.botUsernameConfigured) {
    hints.push(
      "Немає TELEGRAM_BOT_USERNAME — не згенерувати посилання для клієнта (помилка CONFIG у /api/settings/telegram-link).",
    );
  }
  if (d.client) {
    if (!d.client.telegramLinked) {
      hints.push(
        "У клієнта не збережено telegram_chat_id: натисни «Telegram link» у рядку клієнта, надішли посилання клієнту, нехай відкриє бота й натисне Start. Лише нік у полі недостатньо.",
      );
    } else if (!d.hostingEnv.botTokenConfigured) {
      hints.push(
        "Навіть з підключеним клієнтом без токена на хостингу sendMessage не викличеться.",
      );
    }
  }
  if (hints.length === 0) {
    hints.push(
      "Умови для миттєвого повідомлення виглядають виконаними. Переглянь логи хостингу за рядком [telegram-immediate-booking] або помилки Telegram (наприклад бот заблокований користувачем).",
    );
  }
  return hints;
}

/**
 * Діагностика миттєвих Telegram-повідомлень після запису (без секретів у відповіді).
 */
export async function getTelegramNotifyDiagnostics(
  clientId?: string | null,
): Promise<ServiceResult<TelegramNotifyDiagnostics>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const hostingEnv = {
    botTokenConfigured: isTelegramBotTokenConfigured(),
    botUsernameConfigured: getTelegramBotUsername() != null,
  };

  const trimmedClientId = clientId?.trim() ?? "";
  if (!trimmedClientId) {
    const data: TelegramNotifyDiagnostics = {
      hostingEnv,
      hints: [],
    };
    data.hints = buildHints(data);
    return { ok: true, data };
  }

  const { supabase, userId } = ctx.data;
  const { data: row, error } = await supabase
    .from("clients")
    .select("id, telegram_chat_id, telegram_username")
    .eq("id", trimmedClientId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: {
        code: "QUERY_FAILED",
        message: "Не вдалося завантажити клієнта.",
      },
    };
  }
  if (!row) {
    return {
      ok: false,
      error: {
        code: "CLIENT_NOT_FOUND",
        message: "Клієнта не знайдено або він не належить твоєму акаунту.",
      },
    };
  }

  const client = {
    id: row.id as string,
    telegramLinked: telegramLinkedFromRow(
      row.telegram_chat_id as string | number | null,
    ),
    telegramUsernameSet: Boolean(
      (row.telegram_username as string | null)?.trim(),
    ),
  };

  const data: TelegramNotifyDiagnostics = {
    hostingEnv,
    client,
    hints: [],
  };
  data.hints = buildHints(data);
  return { ok: true, data };
}

"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

type Props = {
  telegramLinked: boolean;
};

export function TelegramSettingsCard({ telegramLinked }: Props) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generateLink() {
    setPending(true);
    setError(null);
    setDeepLink(null);
    try {
      const res = await fetch("/api/settings/telegram-link", { method: "POST" });
      const json = (await res.json()) as
        | { data: { deepLink: string } }
        | { error: { message: string } };
      if (!res.ok || !("data" in json)) {
        setError(
          "error" in json ? json.error.message : "Не вдалося згенерувати посилання.",
        );
        return;
      }
      setDeepLink(json.data.deepLink);
    } catch {
      setError("Мережова помилка. Спробуй ще раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-800/50 bg-violet-950/40 p-6 text-violet-50 shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-violet-300" aria-hidden />
        <h2 className="text-lg font-semibold">Telegram-нагадування</h2>
      </div>
      <p className="mb-4 text-sm text-violet-200">
        Підключи бота клієнта: одразу після створення запису (якщо в клієнта є Telegram) прийде підтвердження; ще
        раз нагадаємо приблизно за 2 години до візиту. Для другого етапу потрібен cron у Supabase.
      </p>
      {telegramLinked ? (
        <p className="text-sm font-medium text-emerald-300">Бота підключено.</p>
      ) : (
        <p className="mb-4 text-sm text-violet-300">Бот ще не підключений.</p>
      )}
      <button
        type="button"
        onClick={() => void generateLink()}
        disabled={pending}
        className="rounded-lg border border-violet-600/60 bg-violet-800/40 px-4 py-2 text-sm font-medium text-violet-50 transition hover:bg-violet-700/50 disabled:opacity-60"
      >
        {pending ? "Зачекай…" : "Отримати посилання для Telegram"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {deepLink ? (
        <div className="mt-4 rounded-lg border border-violet-700/50 bg-violet-900/30 p-3">
          <p className="mb-2 text-xs text-violet-300">Відкрий посилання й натисни «Start»:</p>
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-violet-200 underline hover:text-white"
          >
            {deepLink}
          </a>
        </div>
      ) : null}
    </section>
  );
}

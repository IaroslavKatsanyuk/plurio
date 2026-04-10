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
  const [diagClientId, setDiagClientId] = useState("");
  const [diagJson, setDiagJson] = useState<string | null>(null);
  const [diagPending, setDiagPending] = useState(false);

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

  async function runNotifyDiagnostic() {
    setDiagPending(true);
    setDiagJson(null);
    try {
      const q = diagClientId.trim()
        ? `?client_id=${encodeURIComponent(diagClientId.trim())}`
        : "";
      const res = await fetch(`/api/settings/telegram-notify-debug${q}`);
      const json: unknown = await res.json();
      setDiagJson(JSON.stringify(json, null, 2));
    } catch {
      setDiagJson(JSON.stringify({ error: "Мережева помилка" }, null, 2));
    } finally {
      setDiagPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-800/50 bg-violet-950/40 p-6 text-violet-50 shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-violet-300" aria-hidden />
        <h2 className="text-lg font-semibold">Telegram-нагадування</h2>
      </div>
      <p className="mb-4 text-sm text-violet-200">
        Миттєве підтвердження в Telegram надсилається лише клієнтам, які відкрили персональне посилання («Telegram
        link» у рядку клієнта) — у таблиці має бути статус «Підключено». Лише нік у полі недостатньо. Нагадування
        ~за 2 год до візиту потребує cron у Supabase.
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

      <div className="mt-6 border-t border-violet-700/40 pt-4">
        <p className="mb-2 text-sm font-medium text-violet-100">Чому не прийшло повідомлення клієнту?</p>
        <p className="mb-3 text-xs text-violet-300">
          Опційно вкажи UUID клієнта з таблиці клієнтів — перевіримо лише твої дані, без секретів.
        </p>
        <input
          type="text"
          value={diagClientId}
          onChange={(e) => setDiagClientId(e.target.value)}
          placeholder="client_id (опційно)"
          className="mb-2 w-full max-w-md rounded-md border border-violet-600/50 bg-violet-950/80 px-3 py-2 text-sm text-violet-50 placeholder:text-violet-500"
        />
        <button
          type="button"
          onClick={() => void runNotifyDiagnostic()}
          disabled={diagPending}
          className="rounded-lg border border-amber-600/60 bg-amber-900/30 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-800/40 disabled:opacity-60"
        >
          {diagPending ? "Перевірка…" : "Запустити діагностику"}
        </button>
        {diagJson ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-violet-700/50 bg-zinc-950/80 p-3 text-left text-xs text-violet-100">
            {diagJson}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

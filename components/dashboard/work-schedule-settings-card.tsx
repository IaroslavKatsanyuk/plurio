"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";

import {
  DEFAULT_BOOKING_TIMEZONE,
  WEEKDAY_KEYS,
  type WeekdayKey,
  type WeeklyScheduleFormInput,
} from "@/lib/work-schedule";

const DAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Понеділок",
  tue: "Вівторок",
  wed: "Середа",
  thu: "Четвер",
  fri: "П’ятниця",
  sat: "Субота",
  sun: "Неділя",
};

const COMMON_TIMEZONES = [
  "Europe/Kyiv",
  "Europe/Warsaw",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
];

type Props = {
  initialTimezone: string;
  initialWeekly: WeeklyScheduleFormInput;
  /** true якщо у БД вже збережено work_weekly_schedule (не лише легасі за замовчуванням) */
  hasExplicitSchedule: boolean;
};

export function WorkScheduleSettingsCard({
  initialTimezone,
  initialWeekly,
  hasExplicitSchedule,
}: Props) {
  const initialIsCommon = COMMON_TIMEZONES.includes(initialTimezone);
  const [useCustomTz, setUseCustomTz] = useState(!initialIsCommon);
  const [timezone, setTimezone] = useState(
    initialIsCommon ? initialTimezone : DEFAULT_BOOKING_TIMEZONE,
  );
  const [customTzValue, setCustomTzValue] = useState(
    initialIsCommon ? "" : initialTimezone,
  );
  const [weekly, setWeekly] = useState<WeeklyScheduleFormInput>(initialWeekly);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [pending, setPending] = useState(false);

  function setDay(key: WeekdayKey, patch: Partial<WeeklyScheduleFormInput[WeekdayKey]>) {
    setWeekly((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setSavedOk(false);
  }

  function effectiveTimezone(): string {
    if (useCustomTz) {
      return customTzValue.trim() || DEFAULT_BOOKING_TIMEZONE;
    }
    return timezone.trim() || DEFAULT_BOOKING_TIMEZONE;
  }

  async function onSave() {
    setPending(true);
    setError(null);
    setSavedOk(false);
    try {
      const res = await fetch("/api/settings/work-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_timezone: effectiveTimezone(),
          weekly,
        }),
      });
      const json = (await res.json()) as
        | { data: unknown }
        | { error: { message: string } };
      if (!res.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося зберегти графік.");
        return;
      }
      setSavedOk(true);
    } catch {
      setError("Мережева помилка. Спробуй ще раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">Робочий графік і бронювання</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Календар слотів у Telegram-боті та перевірка нових записів у дашборді йдуть за цим графіком (локальний час
        обраної зони).
      </p>
      {!hasExplicitSchedule ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Зараз діє стандартний режим як раніше: щодня 08:00–21:00. Збережи форму нижче, щоб зафіксувати власний
          графік у профілі.
        </p>
      ) : null}

      <div className="mb-6 max-w-xl">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Часова зона (IANA)</label>
        <select
          value={useCustomTz ? "__custom__" : timezone}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__custom__") {
              setUseCustomTz(true);
              setCustomTzValue((prev) =>
                prev.trim() ? prev : effectiveTimezone(),
              );
            } else {
              setUseCustomTz(false);
              setTimezone(v);
              setCustomTzValue("");
            }
            setSavedOk(false);
          }}
          className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        >
          {COMMON_TIMEZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
          <option value="__custom__">Інша (ввести вручну)</option>
        </select>
        {useCustomTz ? (
          <input
            type="text"
            value={customTzValue}
            onChange={(e) => {
              setCustomTzValue(e.target.value);
              setSavedOk(false);
            }}
            placeholder="наприклад Europe/Vienna"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
        ) : null}
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Вихідні щотижня:</span> зніми галочку біля дня — тоді цей день
        тижня повністю без записів (наприклад, вимкни суботу й неділю). Після змін натисни «Зберегти графік».
      </p>
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Відпустка на конкретні дати:</span> прокрути сторінку нижче —
        блок «Відпустка та неробочі дні».
      </p>

      <div className="space-y-3">
        {WEEKDAY_KEYS.map((key) => (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
          >
            <label className="flex min-w-[9rem] cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={weekly[key].enabled}
                onChange={(e) => setDay(key, { enabled: e.target.checked })}
                className="rounded border-primary text-muted-foreground focus:ring-ring"
              />
              {DAY_LABELS[key]}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                disabled={!weekly[key].enabled}
                value={weekly[key].start}
                onChange={(e) => setDay(key, { start: e.target.value })}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="time"
                disabled={!weekly[key].enabled}
                value={weekly[key].end}
                onChange={(e) => setDay(key, { end: e.target.value })}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={pending}
        className="mt-6 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Збереження…" : "Зберегти графік"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {savedOk ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">Збережено.</p>
      ) : null}
    </section>
  );
}

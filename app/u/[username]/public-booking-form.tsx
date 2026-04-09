"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
// Same stack as appointments: DateTimePickerInput → CalendarWithTime → @/components/ui/calendar.
import { DateTimePickerInput } from "@/components/ui/date-time-picker-input";
import { Input } from "@/components/ui/input";

import { isoToLocalDatetimeInputValue } from "@/lib/datetime-local";
import type { PublicBookingPageData } from "@/services/public-booking.service";

/** Темна тема полів (узгоджено з Input і дашбордом). */
const darkSelectClassName =
  "flex h-10 w-full rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-sm text-violet-100 outline-none transition focus-visible:ring-2 focus-visible:ring-violet-500";

type Props = {
  username: string;
  initial: PublicBookingPageData;
};

export function PublicBookingForm({ username, initial }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceId, setServiceId] = useState(
    initial.services[0]?.id ?? "",
  );
  const [startsAt, setStartsAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [slotStartsIso, setSlotStartsIso] = useState<
    string[] | null | undefined
  >(undefined);

  const hasCatalog = initial.services.length > 0;

  const datePart = useMemo(() => {
    if (!startsAt) {
      return "";
    }
    const [d] = startsAt.split("T");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
  }, [startsAt]);

  useEffect(() => {
    if (!datePart) {
      setSlotStartsIso(undefined);
      return;
    }
    if (hasCatalog && !serviceId) {
      setSlotStartsIso(undefined);
      return;
    }

    const ac = new AbortController();
    setSlotStartsIso(null);

    const [y, m, d] = datePart.split("-").map(Number);
    const dayStart = new Date(y, (m ?? 1) - 1, d ?? 1);

    const params = new URLSearchParams({
      dayStartIso: dayStart.toISOString(),
    });
    if (hasCatalog && serviceId) {
      params.set("service_id", serviceId);
    }

    void fetch(
      `/api/public/u/${encodeURIComponent(username)}/availability?${params.toString()}`,
      { signal: ac.signal },
    )
      .then(async (res) => {
        const json = (await res.json()) as
          | { data: { slotStartsIso: string[] } }
          | { error: unknown };
        if (!res.ok || !("data" in json)) {
          setSlotStartsIso([]);
          return;
        }
        setSlotStartsIso(json.data.slotStartsIso);
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setSlotStartsIso([]);
        }
      });

    return () => ac.abort();
  }, [username, datePart, hasCatalog, serviceId]);

  useLayoutEffect(() => {
    if (slotStartsIso === null || slotStartsIso === undefined) {
      return;
    }
    if (slotStartsIso.length === 0) {
      if (datePart) {
        setStartsAt("");
      }
      return;
    }
    if (!startsAt) {
      setStartsAt(isoToLocalDatetimeInputValue(slotStartsIso[0]!));
      return;
    }
    const currentMs = new Date(startsAt).getTime();
    if (Number.isNaN(currentMs)) {
      setStartsAt(isoToLocalDatetimeInputValue(slotStartsIso[0]!));
      return;
    }
    const ok = slotStartsIso.some((iso) => {
      const t = new Date(iso).getTime();
      return Math.abs(t - currentMs) < 60_000;
    });
    if (!ok) {
      setStartsAt(isoToLocalDatetimeInputValue(slotStartsIso[0]!));
    }
  }, [slotStartsIso, startsAt, datePart]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Вкажіть ім'я.");
      return;
    }
    if (!phone.trim()) {
      setError("Вкажіть телефон.");
      return;
    }
    if (!startsAt) {
      setError("Оберіть дату та час.");
      return;
    }
    if (hasCatalog && !serviceId) {
      setError("Оберіть послугу.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/public/u/${encodeURIComponent(username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: name.trim(),
          phone: phone.trim(),
          telegram_username: telegramUsername.trim() || null,
          notes: notes.trim() || null,
          service_id: hasCatalog ? serviceId || null : null,
          starts_at: new Date(startsAt).toISOString(),
        }),
      });
      const json = (await response.json()) as
        | { data: { appointment_id: string } }
        | { error: { message?: string } };
      if (!response.ok || !("data" in json)) {
        setError(
          "error" in json && json.error?.message
            ? json.error.message
            : "Не вдалося створити запис.",
        );
        return;
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-violet-50">
          Запит на запис надіслано.
        </p>
        <p className="text-sm text-violet-300">
          Майстер отримає запис у своєму розкладі. За потреби з вами зв&apos;яжуться.
        </p>
      </div>
    );
  }

  const businessLabel =
    initial.owner.displayName?.trim() || `@${username}`;

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-center text-sm text-violet-300">
        {businessLabel}
      </p>

      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium text-violet-100"
          htmlFor="pb-name"
        >
          Ім&apos;я <span className="text-red-400">*</span>
        </label>
        <Input
          id="pb-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Наприклад, Олена"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium text-violet-100"
            htmlFor="pb-phone"
          >
            Телефон <span className="text-red-400">*</span>
          </label>
          <Input
            id="pb-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+380…"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium text-violet-100"
            htmlFor="pb-telegram"
          >
            Нік у Telegram
          </label>
          <Input
            id="pb-telegram"
            autoComplete="off"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            placeholder="опційно, без @"
          />
        </div>
      </div>

      {hasCatalog ? (
        <div className="space-y-1.5">
          <label
            className="block text-sm font-medium text-violet-100"
            htmlFor="pb-service"
          >
            Послуга <span className="text-red-400">*</span>
          </label>
          <select
            id="pb-service"
            className={darkSelectClassName}
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            required
          >
            {initial.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes} хв)
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="rounded-lg border border-violet-500/25 bg-violet-950/40 px-3 py-2 text-sm text-violet-200">
          Тривалість запису за замовчуванням — 1 година. Каталог послуг у майстра
          ще не налаштований.
        </p>
      )}

      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium text-violet-100"
          htmlFor="pb-start"
        >
          Дата та час <span className="text-red-400">*</span>
        </label>
        <DateTimePickerInput
          id="pb-start"
          mode="datetime"
          disablePastDays
          hideTimeInCalendar
          value={startsAt}
          onChange={setStartsAt}
          placeholder="Оберіть дату й час"
          slotStartsIso={datePart ? slotStartsIso : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <label
          className="block text-sm font-medium text-violet-100"
          htmlFor="pb-notes"
        >
          Коментар
        </label>
        <Input
          id="pb-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="опційно"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Надсилання…" : "Записатися"}
      </Button>
    </form>
  );
}

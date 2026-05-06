"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Palmtree, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BookingTimeOffRow } from "@/services/types";

type Props = {
  initialRows: BookingTimeOffRow[];
};

export function BookingTimeOffSettingsCard({ initialRows }: Props) {
  const [rows, setRows] = useState<BookingTimeOffRow[]>(initialRows);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/settings/time-off");
    const json = (await res.json()) as { data?: BookingTimeOffRow[]; error?: { message?: string } };
    if (res.ok && json.data) {
      setRows(json.data);
    }
  }

  async function onAdd() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate || startDate,
          note: note.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Не вдалося додати.");
        return;
      }
      setStartDate("");
      setEndDate("");
      setNote("");
      await refresh();
    } catch {
      setError("Мережева помилка.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Прибрати цей неробочий період?")) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/settings/time-off/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Не вдалося видалити.");
        return;
      }
      await refresh();
    } catch {
      setError("Мережева помилка.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatRange(r: BookingTimeOffRow): string {
    const a = r.start_date;
    const b = r.end_date;
    if (a === b) {
      try {
        return format(new Date(`${a}T12:00:00`), "d MMMM yyyy", { locale: uk });
      } catch {
        return a;
      }
    }
    try {
      return `${format(new Date(`${a}T12:00:00`), "d MMM", { locale: uk })} — ${format(new Date(`${b}T12:00:00`), "d MMMM yyyy", { locale: uk })}`;
    } catch {
      return `${a} — ${b}`;
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <Palmtree className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">Відпустка та неробочі дні</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Додай діапазон календарних днів, коли клієнти не зможуть забронювати час у Telegram і ти не зможеш створити
        запис на ці дні в дашборді. Тижневий графік лишається як є — це додаткові винятки.
      </p>

      <div className="mb-6 grid max-w-xl gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            З дати
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            По дату
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Примітка (необовʼязково)
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Відпустка, лікарняний…"
          />
        </label>
        <Button type="button" onClick={() => void onAdd()} disabled={pending || !startDate.trim()}>
          {pending ? "Додавання…" : "Додати період"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Немає додаткових неробочих періодів.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-foreground">{formatRange(r)}</p>
                {r.note?.trim() ? (
                  <p className="text-xs text-muted-foreground">{r.note.trim()}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1 text-destructive hover:bg-destructive/10"
                disabled={deletingId === r.id}
                onClick={() => void onDelete(r.id)}
                aria-label="Видалити період"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Прибрати
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

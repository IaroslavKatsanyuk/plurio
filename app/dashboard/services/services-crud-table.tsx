"use client";

import { Pencil, Plus, Scissors, Search, Trash2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { ServiceRow } from "@/services/types";

export type ServicesCrudTableRef = {
  openCreateModal: () => void;
};

type Props = {
  initialServices: ServiceRow[];
  onCountChange?: (n: number) => void;
};

type ServiceForm = {
  name: string;
  duration_minutes: string;
  price: string;
  category: string;
  description: string;
};

function defaultForm(): ServiceForm {
  return {
    name: "",
    duration_minutes: "60",
    price: "0",
    category: "",
    description: "",
  };
}

function formFromRow(row: ServiceRow): ServiceForm {
  return {
    name: row.name,
    duration_minutes: String(row.duration_minutes),
    price: String(row.price ?? 0),
    category: row.category ?? "",
    description: row.description ?? "",
  };
}

export const ServicesCrudTable = forwardRef<ServicesCrudTableRef, Props>(function ServicesCrudTable(
  { initialServices, onCountChange },
  ref,
) {
  const [rows, setRows] = useState<ServiceRow[]>(initialServices);
  const [form, setForm] = useState<ServiceForm>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openCreateModal: () => {
      setEditingId(null);
      setForm(defaultForm());
      setError(null);
      setIsFormOpen(true);
    },
  }));

  useEffect(() => {
    onCountChange?.(rows.length);
  }, [rows.length, onCountChange]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((s) => {
      const name = s.name.toLowerCase();
      const cat = (s.category ?? "").toLowerCase();
      const desc = (s.description ?? "").toLowerCase();
      return name.includes(q) || cat.includes(q) || desc.includes(q);
    });
  }, [rows, search]);

  async function submitForm() {
    const minutes = Number(form.duration_minutes);
    const price = Number.parseFloat(String(form.price).replace(",", "."));
    if (!form.name.trim() || !Number.isFinite(minutes) || minutes <= 0) {
      setError("Вкажи назву та коректну тривалість у хвилинах.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Вкажи коректну ціну (≥ 0).");
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (editingId) {
        const response = await fetch(`/api/services/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            duration_minutes: Math.floor(minutes),
            price,
            category: form.category.trim() || null,
            description: form.description.trim() || null,
          }),
        });
        const json = (await response.json()) as { data?: ServiceRow; error?: { message?: string } };
        if (!response.ok || !json.data) {
          setError(json.error?.message ?? "Не вдалося оновити послугу.");
          return;
        }
        setRows((prev) => prev.map((row) => (row.id === editingId ? json.data! : row)));
      } else {
        const response = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            duration_minutes: Math.floor(minutes),
            price,
            category: form.category.trim() || null,
            description: form.description.trim() || null,
          }),
        });
        const json = (await response.json()) as { data?: ServiceRow; error?: { message?: string } };
        if (!response.ok || !json.data) {
          setError(json.error?.message ?? "Не вдалося створити послугу.");
          return;
        }
        setRows((prev) => [json.data!, ...prev]);
      }
      setForm(defaultForm());
      setEditingId(null);
      setIsFormOpen(false);
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Видалити послугу?")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message?: string } };
        setError(json.error?.message ?? "Не вдалося видалити послугу.");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setIsFormOpen(false);
        setForm(defaultForm());
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Modal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingId(null);
          setForm(defaultForm());
          setError(null);
        }}
        title={editingId ? "Редагувати послугу" : "Нова послуга"}
      >
        <div className="grid gap-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <label className="grid gap-1 text-sm text-muted-foreground">
            Назва *
            <Input
              placeholder="Напр. Манікюр"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-muted-foreground">
              Ціна (₴)
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-muted-foreground">
              Тривалість (хв) *
              <Input
                type="text"
                inputMode="numeric"
                placeholder="60"
                value={form.duration_minutes}
                onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Категорія
            <Input
              placeholder="Напр. Нігті"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Опис
            <textarea
              className={cn(
                "min-h-[72px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
              )}
              rows={3}
              placeholder="Короткий опис послуги…"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void submitForm()} disabled={pending}>
            {editingId ? "Зберегти" : "Додати"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setIsFormOpen(false);
              setEditingId(null);
              setForm(defaultForm());
              setError(null);
            }}
          >
            Скасувати
          </Button>
        </div>
      </Modal>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="bg-muted/40 pl-9"
          placeholder="Пошук за назвою або категорією..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Пошук послуг"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-16 text-center text-muted-foreground shadow-sm">
          <Scissors className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden />
          <p className="font-medium text-foreground">Послуг немає</p>
          <Button
            type="button"
            size="sm"
            className="mt-4 gap-1"
            onClick={() => {
              setEditingId(null);
              setForm(defaultForm());
              setError(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Додати послугу
          </Button>
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Послуга / опис
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Тривалість, хв
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ціна, ₴
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                      Нічого не знайдено
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-foreground">{row.name}</p>
                        {row.description ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
                        ) : null}
                        {row.category ? (
                          <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {row.category}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center text-foreground">{row.duration_minutes} хв</td>
                      <td className="px-4 py-3 text-center font-bold text-primary">
                        {row.price.toLocaleString("uk-UA")} ₴
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            title="Редагувати"
                            aria-label="Редагувати послугу"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-sm transition-colors hover:bg-amber-200"
                            onClick={() => {
                              setEditingId(row.id);
                              setForm(formFromRow(row));
                              setError(null);
                              setIsFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            title="Видалити"
                            aria-label="Видалити послугу"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition-colors hover:bg-rose-200"
                            onClick={() => void onDelete(row.id)}
                            disabled={pending}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
});

ServicesCrudTable.displayName = "ServicesCrudTable";

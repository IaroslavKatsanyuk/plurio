"use client";

import {
  AlertTriangle,
  Edit,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { ProductRow } from "@/services/types";

export type ProductsCrudTableRef = {
  openCreateModal: () => void;
};

type Props = {
  initialProducts: ProductRow[];
  onCountChange?: (n: number) => void;
};

type ProductForm = {
  name: string;
  price: string;
  stock: string;
  category: string;
  description: string;
};

function defaultForm(): ProductForm {
  return {
    name: "",
    price: "0",
    stock: "0",
    category: "",
    description: "",
  };
}

function formFromRow(row: ProductRow): ProductForm {
  return {
    name: row.name,
    price: String(row.price ?? 0),
    stock: String(row.stock ?? 0),
    category: row.category ?? "",
    description: row.description ?? "",
  };
}

const LOW_STOCK_MAX = 3;

export const ProductsCrudTable = forwardRef<ProductsCrudTableRef, Props>(function ProductsCrudTable(
  { initialProducts, onCountChange },
  ref,
) {
  const [rows, setRows] = useState<ProductRow[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<ProductForm>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [stockPendingId, setStockPendingId] = useState<string | null>(null);
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
    return rows.filter((p) => {
      const name = p.name.toLowerCase();
      const cat = (p.category ?? "").toLowerCase();
      const desc = (p.description ?? "").toLowerCase();
      return name.includes(q) || cat.includes(q) || desc.includes(q);
    });
  }, [rows, search]);

  async function submitForm() {
    const price = Number.parseFloat(String(form.price).replace(",", "."));
    const stock = Math.max(0, Math.floor(Number(form.stock)));
    if (!form.name.trim()) {
      setError("Вкажи назву товару.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Некоректна ціна.");
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setError("Некоректний залишок.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      if (editingId) {
        const response = await fetch(`/api/products/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            price,
            stock,
            category: form.category.trim() || null,
            description: form.description.trim() || null,
          }),
        });
        const json = (await response.json()) as { data?: ProductRow; error?: { message?: string } };
        if (!response.ok || !json.data) {
          setError(json.error?.message ?? "Не вдалося оновити товар.");
          return;
        }
        setRows((prev) => prev.map((r) => (r.id === editingId ? json.data! : r)));
      } else {
        const response = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            price,
            stock,
            category: form.category.trim() || null,
            description: form.description.trim() || null,
          }),
        });
        const json = (await response.json()) as { data?: ProductRow; error?: { message?: string } };
        if (!response.ok || !json.data) {
          setError(json.error?.message ?? "Не вдалося створити товар.");
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

  async function adjustStock(product: ProductRow, delta: number) {
    const newStock = Math.max(0, product.stock + delta);
    setStockPendingId(product.id);
    setError(null);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock }),
      });
      const json = (await response.json()) as { data?: ProductRow; error?: { message?: string } };
      if (!response.ok || !json.data) {
        setError(json.error?.message ?? "Не вдалося оновити залишок.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === product.id ? json.data! : r)));
    } finally {
      setStockPendingId(null);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Видалити товар?")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message?: string } };
        setError(json.error?.message ?? "Не вдалося видалити товар.");
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
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
    <div className="mx-auto max-w-5xl space-y-5">
      <Modal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingId(null);
          setForm(defaultForm());
          setError(null);
        }}
        title={editingId ? "Редагувати товар" : "Новий товар"}
      >
        <div className="grid gap-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <label className="grid gap-1 text-sm text-muted-foreground">
            Назва *
            <Input
              placeholder="Назва товару"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-muted-foreground">
              Ціна за штуку (₴)
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm text-muted-foreground">
              Залишок (шт)
              <Input
                type="number"
                min={0}
                step={1}
                value={form.stock}
                onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Категорія
            <Input
              placeholder="Напр. Косметика"
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
              placeholder="Опис товару…"
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
          aria-label="Пошук товарів"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-16 text-center text-muted-foreground shadow-sm">
          <Package className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden />
          <p className="font-medium text-foreground">Товарів немає</p>
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
            Додати товар
          </Button>
        </div>
      ) : (
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Назва / категорія
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ціна за шт, ₴
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Залишок, шт
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Загальна вартість, ₴
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Управління залишком
                  </th>
                  <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Нічого не знайдено
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const isEmpty = p.stock === 0;
                    const isLow = p.stock > 0 && p.stock <= LOW_STOCK_MAX;
                    const total = p.price * p.stock;
                    const stockBusy = stockPendingId === p.id;
                    return (
                      <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 align-top">
                          <p className="font-semibold text-foreground">{p.name}</p>
                          {p.category ? (
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          ) : null}
                          {p.description ? (
                            <p className="mt-0.5 max-w-[220px] truncate text-xs text-muted-foreground" title={p.description}>
                              {p.description}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-blue-600 dark:text-blue-400">
                          {p.price.toLocaleString("uk-UA")} ₴
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "font-semibold",
                              isEmpty && "text-destructive",
                              isLow && !isEmpty && "text-amber-600 dark:text-amber-500",
                              !isEmpty && !isLow && "text-foreground",
                            )}
                          >
                            {p.stock}
                          </span>
                          {isEmpty ? <p className="text-xs text-destructive">Немає</p> : null}
                          {isLow && !isEmpty ? (
                            <p className="flex items-center justify-center gap-0.5 text-xs text-amber-600 dark:text-amber-500">
                              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                              Мало
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-muted-foreground">
                          {total.toLocaleString("uk-UA")} ₴
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              title="Зменшити залишок"
                              disabled={p.stock === 0 || stockBusy}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                              onClick={() => void adjustStock(p, -1)}
                            >
                              <Minus className="h-3 w-3" aria-hidden />
                            </button>
                            <span className="w-8 text-center text-sm font-semibold">{p.stock}</span>
                            <button
                              type="button"
                              title="Збільшити залишок"
                              disabled={stockBusy}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted disabled:opacity-50"
                              onClick={() => void adjustStock(p, 1)}
                            >
                              <Plus className="h-3 w-3" aria-hidden />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              title="Редагувати"
                              aria-label="Редагувати товар"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-sm transition-colors hover:bg-amber-200"
                              onClick={() => {
                                setEditingId(p.id);
                                setForm(formFromRow(p));
                                setError(null);
                                setIsFormOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              title="Видалити"
                              aria-label="Видалити товар"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition-colors hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => void onDelete(p.id)}
                              disabled={pending}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
});

ProductsCrudTable.displayName = "ProductsCrudTable";

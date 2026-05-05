"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Check, MessageCircle, Plus, ShoppingBag, X as XIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { OrderFormModal } from "@/app/orders/order-form-modal";
import { ExportButton, type CsvColumn } from "@/components/dashboard/export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OrderRow, OrderStatus } from "@/services/types";

type Props = {
  initialOrders: OrderRow[];
  initialError?: string | null;
};

type StatusFilter = "all" | OrderStatus;

const statusLabels: Record<OrderStatus, string> = {
  new: "Новий",
  paid: "Оплачено",
  cancelled: "Скасовано",
};

const exportColumns: CsvColumn<OrderRow>[] = [
  { label: "Клієнт", value: (r) => r.client_name },
  { label: "Телефон", value: (r) => r.client_phone ?? "" },
  {
    label: "Товари",
    value: (r) => r.items.map((i) => i.product_name).join("; "),
  },
  { label: "Сума", value: (r) => r.total },
  { label: "Статус", value: (r) => statusLabels[r.status] },
  { label: "Дата", value: (r) => r.created_at.slice(0, 10) },
];

export function OrdersCrud({ initialOrders, initialError }: Props) {
  const [rows, setRows] = useState<OrderRow[]>(initialOrders);
  const [loadError, setLoadError] = useState<string | null>(initialError ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function refreshList() {
    try {
      const response = await fetch("/api/orders");
      const json = (await response.json()) as { data?: OrderRow[]; error?: { message?: string } };
      if (!response.ok) {
        setLoadError(json.error?.message ?? "Не вдалося оновити список.");
        return;
      }
      setRows(json.data ?? []);
      setLoadError(null);
    } catch {
      setLoadError("Помилка мережі.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((o) => {
      const matchSearch =
        !q ||
        o.client_name.toLowerCase().includes(q) ||
        (o.client_phone ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const newCount = rows.filter((o) => o.status === "new").length;
  const totalPaid = rows.filter((o) => o.status === "paid").reduce((s, o) => s + (o.total || 0), 0);

  async function handleStatusChange(id: string, status: OrderStatus) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as { data?: OrderRow; error?: { message?: string } };
      if (!response.ok || !json.data) {
        setLoadError(json.error?.message ?? "Не вдалося оновити статус.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? json.data! : r)));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{loadError}</p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-amber-600 dark:text-amber-500">{newCount} нових</span>
          {" · "}
          Всього продано:{" "}
          <strong className="text-foreground">{totalPaid.toLocaleString("uk-UA")} ₴</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton data={filtered} columns={exportColumns} filename="orders" />
          <Button
            type="button"
            className="gap-2 shadow-md shadow-primary/20"
            onClick={() => {
              setEditOrder(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Нове замовлення
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ShoppingBag
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Пошук за клієнтом або телефоном..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Пошук замовлень"
          />
        </div>
        <div className="relative sm:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            title="Статус"
            className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm text-foreground"
          >
            <option value="all">Всі</option>
            <option value="new">Нові</option>
            <option value="paid">Оплачені</option>
            <option value="cancelled">Скасовані</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            ▾
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-16 text-center text-muted-foreground shadow-sm">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden />
          <p className="font-medium text-foreground">
            {rows.length === 0 ? "Замовлень немає" : "Нічого не знайдено за фільтром"}
          </p>
          {rows.length === 0 ? (
            <Button
              type="button"
              size="sm"
              className="mt-4 gap-1"
              onClick={() => {
                setEditOrder(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Додати замовлення
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div
              key={o.id}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {o.client_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{o.client_name}</p>
                  {o.source === "telegram" ? (
                    <MessageCircle className="h-3.5 w-3.5 shrink-0 text-blue-500" aria-label="Telegram" />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {o.items.length > 0 ? o.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ") : "Без позицій"}
                </p>
                {o.client_phone ? <p className="text-xs text-muted-foreground">{o.client_phone}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-lg font-bold text-primary">{o.total.toLocaleString("uk-UA")} ₴</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(o.created_at), "d MMM", { locale: uk })}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-center text-xs font-medium",
                    o.status === "paid" && "bg-green-100 text-green-800",
                    o.status === "cancelled" && "bg-red-100 text-red-800",
                    o.status === "new" && "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {statusLabels[o.status]}
                </span>
                {o.status === "new" ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Позначити як оплачено"
                      disabled={pendingId === o.id}
                      className="rounded-md bg-green-100 p-1.5 text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50"
                      onClick={() => void handleStatusChange(o.id, "paid")}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      title="Скасувати"
                      disabled={pendingId === o.id}
                      className="rounded-md bg-red-100 p-1.5 text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
                      onClick={() => void handleStatusChange(o.id, "cancelled")}
                    >
                      <XIcon className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                  onClick={() => {
                    setEditOrder(o);
                    setFormOpen(true);
                  }}
                >
                  Редагувати
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditOrder(null);
        }}
        order={editOrder}
        onSaved={() => void refreshList()}
      />
    </div>
  );
}

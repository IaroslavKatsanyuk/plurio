"use client";

import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { Check, FileText, Plus, Printer, X as XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { InvoiceFormModal } from "@/app/invoices/invoice-form-modal";
import { ExportButton, type CsvColumn } from "@/components/dashboard/export-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { InvoiceRow, InvoiceStatus } from "@/services/types";

type Props = {
  initialInvoices: InvoiceRow[];
  initialError?: string | null;
};

type StatusFilter = "all" | InvoiceStatus;

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Чернетка",
  issued: "Виставлено",
  paid: "Оплачено",
  void: "Анульовано",
};

const exportColumns: CsvColumn<InvoiceRow>[] = [
  { label: "Номер", value: (r) => r.number },
  { label: "Клієнт", value: (r) => r.client_name },
  { label: "Email", value: (r) => r.client_email ?? "" },
  { label: "Телефон", value: (r) => r.client_phone ?? "" },
  {
    label: "Позиції",
    value: (r) => r.items.map((i) => `${i.description} ×${i.quantity}`).join("; "),
  },
  { label: "Сума", value: (r) => r.total },
  { label: "Статус", value: (r) => statusLabels[r.status] },
  { label: "Виставлено", value: (r) => r.issued_at.slice(0, 10) },
];

export function InvoicesCrud({ initialInvoices, initialError }: Props) {
  const [rows, setRows] = useState<InvoiceRow[]>(initialInvoices);
  const [loadError, setLoadError] = useState<string | null>(initialError ?? null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<InvoiceRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function refreshList() {
    try {
      const response = await fetch("/api/invoices");
      const json = (await response.json()) as { data?: InvoiceRow[]; error?: { message?: string } };
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
    return rows.filter((inv) => {
      const matchSearch =
        !q ||
        inv.client_name.toLowerCase().includes(q) ||
        String(inv.number).includes(q) ||
        (inv.client_phone ?? "").toLowerCase().includes(q) ||
        (inv.client_email ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const issuedUnpaid = rows.filter((i) => i.status === "issued").length;
  const totalOpen = rows
    .filter((i) => i.status === "issued" || i.status === "draft")
    .reduce((s, i) => s + (i.total || 0), 0);

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = (await response.json()) as { data?: InvoiceRow; error?: { message?: string } };
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
          <span className="font-medium text-amber-600 dark:text-amber-500">{issuedUnpaid} до оплати</span>
          {" · "}
          Сума чернеток + виставлених:{" "}
          <strong className="text-foreground">{totalOpen.toLocaleString("uk-UA")} ₴</strong>
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton data={filtered} columns={exportColumns} filename="invoices" />
          <Button
            type="button"
            className="gap-2 shadow-md shadow-primary/20"
            onClick={() => {
              setEditInvoice(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Новий інвойс
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <FileText
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Пошук за клієнтом, номером, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Пошук інвойсів"
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
            <option value="draft">Чернетки</option>
            <option value="issued">Виставлені</option>
            <option value="paid">Оплачені</option>
            <option value="void">Анульовані</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            ▾
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-16 text-center text-muted-foreground shadow-sm">
          <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" aria-hidden />
          <p className="font-medium text-foreground">
            {rows.length === 0 ? "Інвойсів ще немає" : "Нічого не знайдено за фільтром"}
          </p>
          {rows.length === 0 ? (
            <Button
              type="button"
              size="sm"
              className="mt-4 gap-1"
              onClick={() => {
                setEditInvoice(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Створити інвойс
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-4 sm:flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  #{inv.number}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{inv.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.items.length > 0
                      ? inv.items.map((i) => `${i.description} ×${i.quantity}`).join(", ")
                      : "Без позицій"}
                  </p>
                  {inv.client_phone ? (
                    <p className="text-xs text-muted-foreground">{inv.client_phone}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                <div className="text-left sm:text-right">
                  <p className="font-display text-lg font-bold text-primary">
                    {inv.total.toLocaleString("uk-UA")} ₴
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(inv.issued_at), "d MMM yyyy", { locale: uk })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-center text-xs font-medium",
                      inv.status === "paid" && "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
                      inv.status === "void" && "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
                      inv.status === "issued" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
                      inv.status === "draft" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
                    )}
                  >
                    {statusLabels[inv.status]}
                  </span>
                  {inv.status === "issued" ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="Позначити як оплачено"
                        disabled={pendingId === inv.id}
                        className="rounded-md bg-green-100 p-1.5 text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
                        onClick={() => void handleStatusChange(inv.id, "paid")}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Анулювати"
                        disabled={pendingId === inv.id}
                        className="rounded-md bg-red-100 p-1.5 text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                        onClick={() => void handleStatusChange(inv.id, "void")}
                      >
                        <XIcon className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <Link
                      href={`/invoices/${inv.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Printer className="h-3.5 w-3.5" aria-hidden />
                      Друк / PDF
                    </Link>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => {
                        setEditInvoice(inv);
                        setFormOpen(true);
                      }}
                    >
                      Редагувати
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <InvoiceFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditInvoice(null);
        }}
        invoice={editInvoice}
        onSaved={() => void refreshList()}
      />
    </div>
  );
}

"use client";

import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from "@tanstack/react-table";
import { Link2, Pencil, Search, Trash2 } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { ClientRow } from "@/services/types";

export type ClientsCrudTableRef = {
  openCreateModal: () => void;
};

type Props = {
  initialClients: ClientRow[];
  /** Для кнопки «Експорт CSV» у шапці сторінки (відфільтровані рядки). */
  onFilteredRowsChange?: (rows: ClientRow[]) => void;
};

type ClientFormState = {
  name: string;
  phone: string;
  telegram_username: string;
  notes: string;
};

const columnHelper = createColumnHelper<ClientRow>();

function defaultForm(): ClientFormState {
  return {
    name: "",
    phone: "",
    telegram_username: "",
    notes: "",
  };
}

function toTelHref(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, "");
  return `tel:${normalized}`;
}

function toTelegramUrl(username: string): string {
  const normalized = username.replace(/^@+/, "").trim();
  return `https://t.me/${normalized}`;
}

function formatTelegramDisplay(username: string): string {
  const u = username.replace(/^@+/, "").trim();
  return u ? `@${u}` : username;
}

export const ClientsCrudTable = forwardRef<ClientsCrudTableRef, Props>(function ClientsCrudTable(
  { initialClients, onFilteredRowsChange },
  ref,
) {
  const [rows, setRows] = useState<ClientRow[]>(initialClients);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState<ClientFormState>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState>(defaultForm());
  const [telegramLink, setTelegramLink] = useState<{
    clientName: string;
    deepLink: string;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    openCreateModal: () => {
      setCreateForm(defaultForm());
      setError(null);
      setIsCreateOpen(true);
    },
  }));

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => {
      const name = row.name.toLowerCase();
      const phone = (row.phone ?? "").toLowerCase();
      const tg = (row.telegram_username ?? "").toLowerCase();
      const notes = (row.notes ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || tg.includes(q) || notes.includes(q);
    });
  }, [query, rows]);

  useEffect(() => {
    onFilteredRowsChange?.(filteredRows);
  }, [filteredRows, onFilteredRowsChange]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "ID",
        enableSorting: false,
        cell: (info) => (
          <span className="font-mono text-xs text-muted-foreground">{info.getValue().slice(0, 8)}</span>
        ),
      }),
      columnHelper.accessor("name", {
        header: "Ім'я",
        enableSorting: false,
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      columnHelper.accessor("phone", {
        header: "Телефон",
        enableSorting: false,
        cell: (info) => {
          const phone = info.getValue();
          if (!phone) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <a
              href={toTelHref(phone)}
              className="text-sm text-blue-600 underline underline-offset-2 hover:text-blue-700"
            >
              {phone}
            </a>
          );
        },
      }),
      columnHelper.accessor("telegram_username", {
        header: "Telegram",
        enableSorting: false,
        cell: (info) => {
          const username = info.getValue();
          const linked = info.row.original.telegram_chat_id != null;
          if (!username) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="flex flex-col gap-1.5">
              <a
                href={toTelegramUrl(username)}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-blue-600 underline underline-offset-2 hover:text-blue-700"
              >
                {formatTelegramDisplay(username)}
              </a>
              <span
                className={
                  linked
                    ? "inline-flex w-fit rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800"
                    : "inline-flex w-fit rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                }
              >
                {linked ? "Підключено" : "Не підключено"}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor("notes", {
        header: "Нотатки",
        enableSorting: false,
        cell: (info) => {
          const notes = info.getValue();
          if (!notes?.trim()) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="line-clamp-2 max-w-[220px] text-xs text-muted-foreground" title={notes}>
              {notes}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "Дії",
        cell: ({ row }) => {
          const canTelegramLink = Boolean(row.original.telegram_username?.trim());
          return (
            <div className="flex flex-wrap justify-end gap-1.5">
              <button
                type="button"
                title="Редагувати"
                aria-label="Редагувати клієнта"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shadow-sm transition-colors hover:bg-amber-200"
                onClick={() => {
                  setEditingId(row.original.id);
                  setEditForm({
                    name: row.original.name,
                    phone: row.original.phone ?? "",
                    telegram_username: row.original.telegram_username ?? "",
                    notes: row.original.notes ?? "",
                  });
                  setError(null);
                }}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                title={canTelegramLink ? "Посилання Telegram" : "Спочатку вкажіть Telegram username"}
                aria-label="Згенерувати посилання Telegram"
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition-colors",
                  canTelegramLink
                    ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
                    : "cursor-not-allowed border-muted bg-muted/40 text-muted-foreground",
                )}
                onClick={() => void onGenerateTelegramLink(row.original)}
                disabled={pending || !canTelegramLink}
              >
                <Link2 className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                title="Видалити"
                aria-label="Видалити клієнта"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 transition-colors hover:bg-rose-200"
                onClick={() => void onDelete(row.original.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        },
      }),
    ],
    [pending],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  });

  async function onCreate() {
    if (!createForm.name.trim()) {
      setError("Ім'я клієнта обов'язкове.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          phone: createForm.phone || null,
          telegram_username: createForm.telegram_username || null,
          notes: createForm.notes.trim() || null,
        }),
      });
      const json = (await response.json()) as
        | { data: ClientRow }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося створити клієнта.");
        return;
      }
      setRows((prev) => [json.data, ...prev]);
      setCreateForm(defaultForm());
      setIsCreateOpen(false);
    } finally {
      setPending(false);
    }
  }

  async function onUpdate() {
    if (!editingId) {
      return;
    }
    if (!editForm.name.trim()) {
      setError("Ім'я клієнта обов'язкове.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone || null,
          telegram_username: editForm.telegram_username || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      const json = (await response.json()) as
        | { data: ClientRow }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося оновити клієнта.");
        return;
      }
      setRows((prev) => prev.map((row) => (row.id === json.data.id ? json.data : row)));
      setEditingId(null);
      setEditForm(defaultForm());
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Видалити клієнта?")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message?: string } };
        setError(json.error?.message ?? "Не вдалося видалити клієнта.");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      if (editingId === id) {
        setEditingId(null);
      }
    } finally {
      setPending(false);
    }
  }

  async function onGenerateTelegramLink(client: ClientRow) {
    if (!client.telegram_username?.trim()) {
      setError("Спочатку вкажи Telegram username клієнта.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}/telegram-link`, {
        method: "POST",
      });
      const json = (await response.json()) as
        | { data: { deepLink: string } }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося створити Telegram link.");
        return;
      }
      setTelegramLink({
        clientName: client.name,
        deepLink: json.data.deepLink,
      });
    } finally {
      setPending(false);
    }
  }

  const headerGroups = table.getHeaderGroups();

  return (
    <div className="space-y-4">
      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Створити клієнта">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Ім&apos;я
            <Input
              placeholder="Ім'я"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Телефон
            <Input
              placeholder="Телефон"
              value={createForm.phone}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Telegram username
            <Input
              placeholder="Telegram username"
              value={createForm.telegram_username}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  telegram_username: e.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Нотатки
            <textarea
              className={cn(
                "min-h-[80px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
              )}
              placeholder="Короткі примітки про клієнта…"
              rows={3}
              value={createForm.notes}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void onCreate()} disabled={pending}>
            Створити
          </Button>
        </div>
      </Modal>

      <Modal
        open={editingId !== null}
        onClose={() => {
          setEditingId(null);
          setEditForm(defaultForm());
          setError(null);
        }}
        title="Редагувати клієнта"
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Ім&apos;я
            <Input
              placeholder="Ім'я"
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Телефон
            <Input
              placeholder="Телефон"
              value={editForm.phone}
              onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Telegram username
            <Input
              placeholder="Telegram username"
              value={editForm.telegram_username}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  telegram_username: e.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Нотатки
            <textarea
              className={cn(
                "min-h-[80px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
              )}
              placeholder="Короткі примітки про клієнта…"
              rows={3}
              value={editForm.notes}
              onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={() => void onUpdate()} disabled={pending}>
            Зберегти
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditingId(null);
              setEditForm(defaultForm());
              setError(null);
            }}
            disabled={pending}
          >
            Скасувати
          </Button>
        </div>
      </Modal>

      <section className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground">Список клієнтів</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="bg-muted/50 pl-9"
              placeholder="Пошук: ім'я, телефон, telegram, нотатки"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Пошук клієнтів"
            />
          </div>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? "Клієнтів ще немає." : "Нічого не знайдено за запитом."}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-3 align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {telegramLink ? (
        <section className="rounded-2xl border border-border bg-muted/40 p-4 text-foreground">
          <h3 className="mb-2 text-sm font-semibold">Telegram-посилання для {telegramLink.clientName}</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Надішли клієнту це посилання. Після натискання Start бот зможе надсилати нагадування.
          </p>
          <a
            href={telegramLink.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-sm text-primary underline hover:opacity-90"
          >
            {telegramLink.deepLink}
          </a>
        </section>
      ) : null}
    </div>
  );
});

ClientsCrudTable.displayName = "ClientsCrudTable";

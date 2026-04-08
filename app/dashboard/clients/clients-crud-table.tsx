"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  createColumnHelper,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ClientRow } from "@/services/types";

type Props = {
  initialClients: ClientRow[];
};

type ClientFormState = {
  name: string;
  phone: string;
  telegram_username: string;
};

const columnHelper = createColumnHelper<ClientRow>();

function defaultForm(): ClientFormState {
  return {
    name: "",
    phone: "",
    telegram_username: "",
  };
}

export function ClientsCrudTable({ initialClients }: Props) {
  const [rows, setRows] = useState<ClientRow[]>(initialClients);
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [createForm, setCreateForm] = useState<ClientFormState>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ClientFormState>(defaultForm());

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return rows;
    }
    return rows.filter((row) => {
      const name = row.name.toLowerCase();
      const phone = (row.phone ?? "").toLowerCase();
      const tg = (row.telegram_username ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || tg.includes(q);
    });
  }, [query, rows]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: "ID",
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue().slice(0, 8)}</span>
        ),
      }),
      columnHelper.accessor("name", {
        header: "Ім'я",
      }),
      columnHelper.accessor("phone", {
        header: "Телефон",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("telegram_username", {
        header: "Telegram",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.display({
        id: "actions",
        header: "Дії",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => {
                setEditingId(row.original.id);
                setEditForm({
                  name: row.original.name,
                  phone: row.original.phone ?? "",
                  telegram_username: row.original.telegram_username ?? "",
                });
                setError(null);
              }}
            >
              Редагувати
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void onDelete(row.original.id)}
            >
              Видалити
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setCreateForm(defaultForm());
            setError(null);
            setIsCreateOpen(true);
          }}
        >
          Створити клієнта
        </Button>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Створити клієнта"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            placeholder="Ім'я"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <Input
            placeholder="Телефон"
            value={createForm.phone}
            onChange={(e) =>
              setCreateForm((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
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
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void onCreate()} disabled={pending}>
            Створити
          </Button>
        </div>
      </Modal>

      <section className="rounded-2xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-4 text-violet-50">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-violet-50">
            Список клієнтів
          </h2>
          <Input
            className="sm:max-w-sm"
            placeholder="Пошук: ім'я, телефон, telegram"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {error ? (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-violet-800/70">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2 text-left font-medium">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 text-violet-200 hover:text-violet-50"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {{
                            asc: "↑",
                            desc: "↓",
                          }[header.column.getIsSorted() as "asc" | "desc"] ?? null}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-violet-100 dark:border-violet-900">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingId ? (
        <section className="rounded-2xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-4 text-violet-50">
          <h2 className="mb-3 text-lg font-semibold text-violet-50">
            Редагувати клієнта
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Ім'я"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Input
              placeholder="Телефон"
              value={editForm.phone}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
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
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={() => void onUpdate()} disabled={pending}>
              Зберегти
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingId(null)}
              disabled={pending}
            >
              Скасувати
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

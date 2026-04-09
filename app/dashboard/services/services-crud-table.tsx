"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { ServiceRow } from "@/services/types";

type Props = {
  initialServices: ServiceRow[];
};

type ServiceForm = {
  name: string;
  duration_minutes: string;
};

function defaultForm(): ServiceForm {
  return { name: "", duration_minutes: "" };
}

export function ServicesCrudTable({ initialServices }: Props) {
  const [rows, setRows] = useState<ServiceRow[]>(initialServices);
  const [form, setForm] = useState<ServiceForm>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function onCreate() {
    const minutes = Number(form.duration_minutes);
    if (!form.name.trim() || !Number.isFinite(minutes) || minutes <= 0) {
      setError("Вкажи назву та коректну тривалість у хвилинах.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, duration_minutes: minutes }),
      });
      const json = (await response.json()) as
        | { data: ServiceRow }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося створити послугу.");
        return;
      }
      setRows((prev) => [json.data, ...prev]);
      setForm(defaultForm());
      setIsCreateOpen(false);
    } finally {
      setPending(false);
    }
  }

  async function onUpdate() {
    if (!editingId) {
      return;
    }
    const minutes = Number(form.duration_minutes);
    if (!form.name.trim() || !Number.isFinite(minutes) || minutes <= 0) {
      setError("Вкажи назву та коректну тривалість у хвилинах.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/services/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, duration_minutes: minutes }),
      });
      const json = (await response.json()) as
        | { data: ServiceRow }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося оновити послугу.");
        return;
      }
      setRows((prev) => prev.map((row) => (row.id === json.data.id ? json.data : row)));
      setEditingId(null);
      setForm(defaultForm());
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
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
            setForm(defaultForm());
            setError(null);
            setIsCreateOpen(true);
          }}
        >
          Додати послугу
        </Button>
      </div>

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Нова послуга">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-violet-200">
            Назва послуги
            <Input
              placeholder="Назва послуги"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
            Тривалість (хв)
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Тривалість (хв)"
              value={form.duration_minutes}
              onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
            />
          </label>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void onCreate()} disabled={pending}>
            Зберегти
          </Button>
        </div>
      </Modal>

      <section className="rounded-2xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-4 text-violet-50">
        <h2 className="mb-3 text-lg font-semibold">Каталог послуг</h2>
        {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-violet-800/70">
                <th className="px-3 py-2 text-left font-medium">Послуга</th>
                <th className="px-3 py-2 text-left font-medium">Тривалість</th>
                <th className="px-3 py-2 text-left font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-violet-900/60">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.duration_minutes} хв</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-amber-300/80 bg-amber-500/20 text-amber-100 hover:bg-amber-500/35 hover:text-amber-50"
                        onClick={() => {
                          setEditingId(row.id);
                          setForm({
                            name: row.name,
                            duration_minutes: String(row.duration_minutes),
                          });
                          setError(null);
                        }}
                      >
                        Редагувати
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-300/80 bg-red-500/20 text-red-100 hover:bg-red-500/35 hover:text-red-50"
                        onClick={() => void onDelete(row.id)}
                      >
                        Видалити
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editingId ? (
        <section className="rounded-2xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-4 text-violet-50">
          <h2 className="mb-3 text-lg font-semibold">Редагувати послугу</h2>
          <div className="grid gap-3">
            <Input
              placeholder="Назва послуги"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Тривалість (хв)"
              value={form.duration_minutes}
              onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={() => void onUpdate()} disabled={pending}>
              Зберегти зміни
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
              Скасувати
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

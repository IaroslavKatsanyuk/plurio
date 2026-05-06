"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { computeInvoiceTotal } from "@/lib/invoice-totals";
import type { InvoiceLineItem, InvoiceRow, InvoiceStatus } from "@/services/types";

type FormLine = { description: string; quantity: string; unit_price: string };

type Props = {
  open: boolean;
  onClose: () => void;
  invoice?: InvoiceRow | null;
  onSaved: () => void;
};

function defaultLines(): FormLine[] {
  return [{ description: "", quantity: "1", unit_price: "0" }];
}

function linesFromInvoice(items: InvoiceLineItem[]): FormLine[] {
  if (items.length === 0) {
    return defaultLines();
  }
  return items.map((i) => ({
    description: i.description,
    quantity: String(i.quantity),
    unit_price: String(i.unit_price),
  }));
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function isoToDateInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 10);
}

function dateInputToIso(date: string): string | null {
  const t = date.trim();
  if (!t) {
    return null;
  }
  return `${t}T12:00:00.000Z`;
}

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Чернетка",
  issued: "Виставлено",
  paid: "Оплачено",
  void: "Анульовано",
};

export function InvoiceFormModal({ open, onClose, invoice, onSaved }: Props) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [issuedLocal, setIssuedLocal] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<FormLine[]>(defaultLines);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    if (invoice) {
      setClientName(invoice.client_name);
      setClientEmail(invoice.client_email ?? "");
      setClientPhone(invoice.client_phone ?? "");
      setStatus(invoice.status);
      setIssuedLocal(isoToDatetimeLocal(invoice.issued_at));
      setDueDate(isoToDateInput(invoice.due_at));
      setNotes(invoice.notes ?? "");
      setLines(linesFromInvoice(invoice.items));
    } else {
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setStatus("draft");
      setIssuedLocal(isoToDatetimeLocal(new Date().toISOString()));
      setDueDate("");
      setNotes("");
      setLines(defaultLines());
    }
  }, [open, invoice]);

  const previewTotal = useMemo(() => {
    const items: InvoiceLineItem[] = [];
    for (const line of lines) {
      const desc = line.description.trim();
      const q = Number.parseFloat(line.quantity.replace(",", "."));
      const p = Number.parseFloat(line.unit_price.replace(",", "."));
      if (!desc) {
        continue;
      }
      if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p < 0) {
        continue;
      }
      items.push({ description: desc, quantity: q, unit_price: p });
    }
    return computeInvoiceTotal(items);
  }, [lines]);

  async function handleSubmit() {
    const name = clientName.trim();
    if (!name) {
      setError("Вкажіть імʼя або назву клієнта.");
      return;
    }

    const items: InvoiceLineItem[] = [];
    for (const line of lines) {
      const desc = line.description.trim();
      const q = Number.parseFloat(line.quantity.replace(",", "."));
      const p = Number.parseFloat(line.unit_price.replace(",", "."));
      if (!desc) {
        continue;
      }
      if (!Number.isFinite(q) || q <= 0) {
        setError("Кількість має бути більшою за 0.");
        return;
      }
      if (!Number.isFinite(p) || p < 0) {
        setError("Ціна не може бути відʼємною.");
        return;
      }
      items.push({ description: desc, quantity: q, unit_price: p });
    }

    if (items.length === 0) {
      setError("Додайте хоча б одну позицію.");
      return;
    }

    const issued_at = issuedLocal.trim() ? datetimeLocalToIso(issuedLocal.trim()) : new Date().toISOString();
    const due_at = dateInputToIso(dueDate);

    setPending(true);
    setError(null);
    try {
      if (invoice) {
        const response = await fetch(`/api/invoices/${invoice.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: name,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            status,
            items,
            notes: notes.trim() || null,
            issued_at,
            due_at,
          }),
        });
        const json = (await response.json()) as { data?: InvoiceRow; error?: { message?: string } };
        if (!response.ok) {
          setError(json.error?.message ?? "Не вдалося зберегти.");
          return;
        }
      } else {
        const response = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: name,
            client_email: clientEmail.trim() || null,
            client_phone: clientPhone.trim() || null,
            status,
            items,
            notes: notes.trim() || null,
            issued_at,
            due_at,
          }),
        });
        const json = (await response.json()) as { data?: InvoiceRow; error?: { message?: string } };
        if (!response.ok) {
          setError(json.error?.message ?? "Не вдалося створити інвойс.");
          return;
        }
      }
      onSaved();
      onClose();
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!invoice || invoice.status !== "draft") {
      return;
    }
    if (!window.confirm("Видалити чернетку? Цю дію не скасувати.")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setError(json.error?.message ?? "Не вдалося видалити.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={invoice ? "Редагування інвойсу" : "Новий інвойс"}>
      <div className="grid max-h-[min(80vh,640px)] gap-3 overflow-y-auto pr-1">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <label className="grid gap-1 text-sm text-muted-foreground">
          Клієнт
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Назва або ПІБ" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Email
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@…"
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Телефон
            <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+380…" />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Статус
            <select
              title="Статус"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
            >
              {(Object.keys(statusLabels) as InvoiceStatus[]).map((k) => (
                <option key={k} value={k}>
                  {statusLabels[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Дата виставлення
            <Input
              type="datetime-local"
              value={issuedLocal}
              onChange={(e) => setIssuedLocal(e.target.value)}
            />
          </label>
        </div>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Сплата до (необовʼязково)
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Примітки
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Договір, умови…" />
        </label>
        <div className="grid gap-2">
          <p className="text-sm font-medium text-foreground">Позиції</p>
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2">
              <Input
                className="min-w-[120px] flex-[2]"
                placeholder="Опис"
                value={line.description}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, description: e.target.value };
                  setLines(next);
                }}
              />
              <Input
                className="w-20"
                type="number"
                min={0.001}
                step={0.001}
                title="Кількість"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, quantity: e.target.value };
                  setLines(next);
                }}
              />
              <Input
                className="w-28"
                type="number"
                min={0}
                step={0.01}
                title="Ціна за од., ₴"
                value={line.unit_price}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, unit_price: e.target.value };
                  setLines(next);
                }}
              />
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                >
                  ✕
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setLines([...lines, { description: "", quantity: "1", unit_price: "0" }])}
          >
            + Позиція
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Разом:{" "}
          <strong className="text-lg text-foreground">{previewTotal.toLocaleString("uk-UA")} ₴</strong>
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleSubmit()} disabled={pending}>
            {invoice ? "Зберегти" : "Створити"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
          {invoice && invoice.status === "draft" ? (
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={pending}>
              Видалити чернетку
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

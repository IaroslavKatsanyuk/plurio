"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { OrderLineItem, OrderRow } from "@/services/types";

type FormLine = { product_name: string; quantity: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Як задано — режим редагування. */
  order?: OrderRow | null;
  onSaved: () => void;
};

function defaultLines(): FormLine[] {
  return [{ product_name: "", quantity: "1" }];
}

function linesFromOrder(items: OrderLineItem[]): FormLine[] {
  if (items.length === 0) {
    return defaultLines();
  }
  return items.map((i) => ({
    product_name: i.product_name,
    quantity: String(i.quantity),
  }));
}

export function OrderFormModal({ open, onClose, order, onSaved }: Props) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [total, setTotal] = useState("");
  const [lines, setLines] = useState<FormLine[]>(defaultLines);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    if (order) {
      setClientName(order.client_name);
      setClientPhone(order.client_phone ?? "");
      setTotal(String(order.total ?? 0));
      setLines(linesFromOrder(order.items));
    } else {
      setClientName("");
      setClientPhone("");
      setTotal("");
      setLines(defaultLines());
    }
  }, [open, order]);

  async function handleSubmit() {
    const name = clientName.trim();
    if (!name) {
      setError("Вкажіть імʼя клієнта.");
      return;
    }
    const totalNum = Number.parseFloat(total.replace(",", "."));
    if (!Number.isFinite(totalNum) || totalNum < 0) {
      setError("Вкажіть коректну суму.");
      return;
    }

    const items: OrderLineItem[] = [];
    for (const line of lines) {
      const pn = line.product_name.trim();
      const q = Number.parseInt(line.quantity, 10);
      if (!pn) {
        continue;
      }
      if (!Number.isFinite(q) || q < 1) {
        setError("Кількість має бути не менше 1.");
        return;
      }
      items.push({ product_name: pn, quantity: q });
    }

    setPending(true);
    setError(null);
    try {
      if (order) {
        const response = await fetch(`/api/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: name,
            client_phone: clientPhone.trim() || null,
            total: totalNum,
            items,
          }),
        });
        const json = (await response.json()) as { data?: OrderRow; error?: { message?: string } };
        if (!response.ok) {
          setError(json.error?.message ?? "Не вдалося зберегти.");
          return;
        }
      } else {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: name,
            client_phone: clientPhone.trim() || null,
            total: totalNum,
            items,
            status: "new",
          }),
        });
        const json = (await response.json()) as { data?: OrderRow; error?: { message?: string } };
        if (!response.ok) {
          setError(json.error?.message ?? "Не вдалося створити замовлення.");
          return;
        }
      }
      onSaved();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={order ? "Редагування замовлення" : "Нове замовлення"}>
      <div className="grid gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <label className="grid gap-1 text-sm text-muted-foreground">
          Клієнт
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Імʼя" />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Телефон
          <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+380…" />
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Сума, ₴
          <Input
            type="number"
            min={0}
            step={0.01}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="0"
          />
        </label>
        <div className="grid gap-2">
          <p className="text-sm font-medium text-foreground">Позиції</p>
          {lines.map((line, idx) => (
            <div key={idx} className="flex flex-wrap gap-2">
              <Input
                className="min-w-[140px] flex-1"
                placeholder="Назва товару / послуги"
                value={line.product_name}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, product_name: e.target.value };
                  setLines(next);
                }}
              />
              <Input
                className="w-24"
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, quantity: e.target.value };
                  setLines(next);
                }}
              />
              {lines.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
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
            onClick={() => setLines([...lines, { product_name: "", quantity: "1" }])}
          >
            + Позиція
          </Button>
        </div>
        <div className="mt-2 flex gap-2">
          <Button type="button" onClick={() => void handleSubmit()} disabled={pending}>
            {order ? "Зберегти" : "Створити"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeInvoiceTotal } from "@/lib/invoice-totals";

import { getAuthenticatedContext } from "./session";
import type {
  CreateInvoiceInput,
  InvoiceLineItem,
  InvoiceRow,
  InvoiceStatus,
  ServiceResult,
  UpdateInvoiceInput,
} from "./types";

function parseMoney(raw: unknown): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const o = entry as Record<string, unknown>;
      const description = typeof o.description === "string" ? o.description : "";
      const quantity =
        typeof o.quantity === "number" && o.quantity > 0
          ? o.quantity
          : typeof o.quantity === "string"
            ? Number.parseFloat(o.quantity)
            : 0;
      const unit_price = parseMoney(o.unit_price);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return null;
      }
      return { description, quantity, unit_price };
    })
    .filter(
      (x): x is InvoiceLineItem =>
        x !== null && x.description.trim().length > 0 && x.unit_price >= 0,
    );
}

export function mapInvoiceRow(row: Record<string, unknown>): InvoiceRow {
  const rawStatus = row.status;
  const status: InvoiceStatus =
    rawStatus === "issued" || rawStatus === "paid" || rawStatus === "void" || rawStatus === "draft"
      ? rawStatus
      : "draft";

  const numberRaw = row.number;
  const number =
    typeof numberRaw === "number"
      ? numberRaw
      : typeof numberRaw === "string"
        ? Number.parseInt(numberRaw, 10)
        : 0;

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    number: Number.isFinite(number) ? number : 0,
    client_name: String(row.client_name ?? ""),
    client_email: row.client_email == null ? null : String(row.client_email),
    client_phone: row.client_phone == null ? null : String(row.client_phone),
    status,
    items: parseItems(row.items),
    total: parseMoney(row.total),
    notes: row.notes == null ? null : String(row.notes),
    issued_at: String(row.issued_at),
    due_at: row.due_at == null ? null : String(row.due_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function nextInvoiceNumber(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase
    .from("invoices")
    .select("number")
    .eq("user_id", userId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as { number?: unknown } | null;
  const n = typeof row?.number === "number" ? row.number : Number.parseInt(String(row?.number ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n + 1 : 1;
}

function validateItems(items: InvoiceLineItem[]): ServiceResult<InvoiceLineItem[]> {
  if (items.length === 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Додайте хоча б одну позицію з описом і ціною." },
    };
  }
  for (const line of items) {
    if (!line.description.trim()) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Опис позиції не може бути порожнім." },
      };
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Кількість має бути більшою за 0." },
      };
    }
    if (!Number.isFinite(line.unit_price) || line.unit_price < 0) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Ціна не може бути відʼємною." },
      };
    }
  }
  return { ok: true, data: items };
}

export async function getInvoices(): Promise<ServiceResult<InvoiceRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false,
      error: {
        code: "INVOICES_LIST_FAILED",
        message: "Не вдалося завантажити інвойси.",
      },
    };
  }

  return {
    ok: true,
    data: (data ?? []).map((r) => mapInvoiceRow(r as Record<string, unknown>)),
  };
}

export async function getInvoiceById(id: string): Promise<ServiceResult<InvoiceRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "INVOICE_NOT_FOUND",
        message: "Інвойс не знайдено.",
      },
    };
  }

  return { ok: true, data: mapInvoiceRow(data as Record<string, unknown>) };
}

export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<ServiceResult<InvoiceRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const name = input.client_name?.trim() ?? "";
  if (!name) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Вкажіть імʼя або назву клієнта." },
    };
  }

  const itemsCheck = validateItems(parseItems(input.items));
  if (!itemsCheck.ok) {
    return itemsCheck;
  }
  const items = itemsCheck.data;
  const total = computeInvoiceTotal(items);

  const status: InvoiceStatus = input.status ?? "draft";
  if (!["draft", "issued", "paid", "void"].includes(status)) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Некоректний статус." },
    };
  }

  const { supabase, userId } = ctx.data;
  const number = await nextInvoiceNumber(supabase, userId);

  const issued_at =
    typeof input.issued_at === "string" && input.issued_at.trim()
      ? input.issued_at.trim()
      : new Date().toISOString();

  const due_at =
    input.due_at === undefined
      ? null
      : input.due_at === null || input.due_at === ""
        ? null
        : String(input.due_at);

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      number,
      client_name: name,
      client_email: input.client_email?.trim() || null,
      client_phone: input.client_phone?.trim() || null,
      status,
      items,
      total,
      notes: input.notes?.trim() || null,
      issued_at,
      due_at,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: {
          code: "INVOICE_NUMBER_CONFLICT",
          message: "Конфлікт номера. Спробуйте ще раз.",
        },
      };
    }
    return {
      ok: false,
      error: {
        code: "INVOICE_CREATE_FAILED",
        message: "Не вдалося створити інвойс.",
      },
    };
  }

  return { ok: true, data: mapInvoiceRow(data as Record<string, unknown>) };
}

export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput,
): Promise<ServiceResult<InvoiceRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const patch: Record<string, unknown> = {};

  if (input.client_name !== undefined) {
    patch.client_name = input.client_name.trim();
  }
  if (input.client_email !== undefined) {
    patch.client_email = input.client_email?.trim() || null;
  }
  if (input.client_phone !== undefined) {
    patch.client_phone = input.client_phone?.trim() || null;
  }
  if (input.status !== undefined) {
    if (!["draft", "issued", "paid", "void"].includes(input.status)) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Некоректний статус." },
      };
    }
    patch.status = input.status;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }
  if (input.issued_at !== undefined) {
    patch.issued_at =
      typeof input.issued_at === "string" && input.issued_at.trim()
        ? input.issued_at.trim()
        : new Date().toISOString();
  }
  if (input.due_at !== undefined) {
    patch.due_at =
      input.due_at === null || input.due_at === "" ? null : String(input.due_at);
  }
  if (input.items !== undefined) {
    const itemsCheck = validateItems(parseItems(input.items));
    if (!itemsCheck.ok) {
      return itemsCheck;
    }
    patch.items = itemsCheck.data;
    patch.total = computeInvoiceTotal(itemsCheck.data);
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Немає полів для оновлення." },
    };
  }

  if (typeof patch.client_name === "string" && !patch.client_name.trim()) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Імʼя клієнта не може бути порожнім." },
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "INVOICE_UPDATE_FAILED",
        message: "Не вдалося оновити інвойс.",
      },
    };
  }

  return { ok: true, data: mapInvoiceRow(data as Record<string, unknown>) };
}

export async function deleteInvoice(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: {
        code: "INVOICE_DELETE_FAILED",
        message: "Не вдалося видалити інвойс.",
      },
    };
  }

  return { ok: true, data: { id } };
}

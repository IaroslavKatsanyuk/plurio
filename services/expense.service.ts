import { getAuthenticatedContext } from "./session";
import type { CreateExpenseInput, ExpenseRow, ServiceResult } from "./types";

export function mapExpenseRow(raw: Record<string, unknown>): ExpenseRow {
  const amountRaw = raw.amount;
  const amount =
    typeof amountRaw === "number" && Number.isFinite(amountRaw)
      ? amountRaw
      : Number.parseFloat(String(amountRaw ?? "0"));

  let occurredOn = String(raw.occurred_on ?? "");
  if (occurredOn.length > 10) {
    occurredOn = occurredOn.slice(0, 10);
  }

  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    title: String(raw.title ?? ""),
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    category: String(raw.category ?? "інше"),
    notes: raw.notes == null || raw.notes === "" ? null : String(raw.notes),
    occurred_on: occurredOn,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function getExpenses(): Promise<ServiceResult<ExpenseRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return {
      ok: false,
      error: {
        code: "EXPENSE_LIST_FAILED",
        message: "Не вдалося завантажити витрати.",
      },
    };
  }

  return { ok: true, data: (data ?? []).map((r) => mapExpenseRow(r as Record<string, unknown>)) };
}

export async function createExpense(input: CreateExpenseInput): Promise<ServiceResult<ExpenseRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  if (!input.title?.trim()) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Назва витрати обовʼязкова." },
    };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Вкажи суму більшу за 0." },
    };
  }

  const occurred = (input.occurred_on ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurred)) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Некоректна дата." },
    };
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      title: input.title.trim(),
      amount,
      category: (input.category ?? "інше").trim() || "інше",
      notes: input.notes?.trim() || null,
      occurred_on: occurred,
    })
    .select()
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "EXPENSE_CREATE_FAILED",
        message: "Не вдалося створити витрату.",
      },
    };
  }

  return { ok: true, data: mapExpenseRow(data as Record<string, unknown>) };
}

export async function deleteExpense(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase.from("expenses").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: {
        code: "EXPENSE_DELETE_FAILED",
        message: "Не вдалося видалити витрату.",
      },
    };
  }

  return { ok: true, data: { id } };
}

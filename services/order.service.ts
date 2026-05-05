import { getAuthenticatedContext } from "./session";
import type {
  CreateOrderInput,
  OrderLineItem,
  OrderRow,
  OrderStatus,
  ServiceResult,
  UpdateOrderInput,
} from "./types";

function parseItems(raw: unknown): OrderLineItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const o = entry as Record<string, unknown>;
      const product_name = typeof o.product_name === "string" ? o.product_name : "";
      const quantity = typeof o.quantity === "number" && o.quantity > 0 ? o.quantity : 1;
      return { product_name, quantity };
    })
    .filter((x): x is OrderLineItem => x !== null && x.product_name.trim().length > 0);
}

export function mapOrderRow(row: Record<string, unknown>): OrderRow {
  const totalRaw = row.total;
  const total =
    typeof totalRaw === "number"
      ? totalRaw
      : typeof totalRaw === "string"
        ? Number.parseFloat(totalRaw)
        : 0;

  const rawStatus = row.status;
  const status: OrderStatus =
    rawStatus === "paid" || rawStatus === "cancelled" || rawStatus === "new"
      ? rawStatus
      : "new";

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    client_name: String(row.client_name ?? ""),
    client_phone: row.client_phone == null ? null : String(row.client_phone),
    source: row.source == null ? null : String(row.source),
    status,
    total: Number.isFinite(total) ? total : 0,
    items: parseItems(row.items),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getOrders(): Promise<ServiceResult<OrderRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false,
      error: {
        code: "ORDERS_LIST_FAILED",
        message: "Не вдалося завантажити замовлення.",
      },
    };
  }

  return {
    ok: true,
    data: (data ?? []).map((r) => mapOrderRow(r as Record<string, unknown>)),
  };
}

export async function createOrder(
  input: CreateOrderInput,
): Promise<ServiceResult<OrderRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const name = input.client_name?.trim() ?? "";
  if (!name) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Вкажіть імʼя клієнта." },
    };
  }

  const total = Number(input.total);
  if (!Number.isFinite(total) || total < 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Некоректна сума замовлення." },
    };
  }

  const items = parseItems(input.items);
  const status: OrderStatus = input.status ?? "new";
  if (!["new", "paid", "cancelled"].includes(status)) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Некоректний статус." },
    };
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      client_name: name,
      client_phone: input.client_phone?.trim() || null,
      source: input.source?.trim() || null,
      status,
      total,
      items,
    })
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      error: {
        code: "ORDER_CREATE_FAILED",
        message: "Не вдалося створити замовлення.",
      },
    };
  }

  return { ok: true, data: mapOrderRow(data as Record<string, unknown>) };
}

export async function updateOrder(
  id: string,
  input: UpdateOrderInput,
): Promise<ServiceResult<OrderRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const patch: Record<string, unknown> = {};
  if (input.client_name !== undefined) {
    patch.client_name = input.client_name.trim();
  }
  if (input.client_phone !== undefined) {
    patch.client_phone = input.client_phone?.trim() || null;
  }
  if (input.source !== undefined) {
    patch.source = input.source?.trim() || null;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.total !== undefined) {
    patch.total = input.total;
  }
  if (input.items !== undefined) {
    patch.items = parseItems(input.items);
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
    .from("orders")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: {
        code: "ORDER_UPDATE_FAILED",
        message: "Не вдалося оновити замовлення.",
      },
    };
  }

  return { ok: true, data: mapOrderRow(data as Record<string, unknown>) };
}

export async function deleteOrder(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase.from("orders").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    return {
      ok: false,
      error: {
        code: "ORDER_DELETE_FAILED",
        message: "Не вдалося видалити замовлення.",
      },
    };
  }

  return { ok: true, data: { id } };
}

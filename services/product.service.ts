import type { PostgrestError } from "@supabase/supabase-js";

import { getAuthenticatedContext } from "./session";
import type {
  CreateProductInput,
  ProductRow,
  ServiceResult,
  UpdateProductInput,
} from "./types";

/** Maps common Supabase/PostgREST failures to an actionable Ukrainian message. */
function messageForProductsDbError(
  error: PostgrestError,
  fallback: string,
): string {
  const blob = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""} ${error.code ?? ""}`.toLowerCase();

  if (
    blob.includes("does not exist") ||
    blob.includes("schema cache") ||
    blob.includes("could not find the table") ||
    error.code === "42P01"
  ) {
    return "Таблиця products відсутня в базі або не в схемі API. Застосуй міграцію supabase/migrations/20260508120000_products.sql (наприклад supabase db push або SQL у Dashboard).";
  }
  if (blob.includes("row-level security") || blob.includes("violates row-level security")) {
    return "Операцію заблоковано політикою RLS для products.";
  }
  if (blob.includes("permission denied")) {
    return "Немає прав на таблицю products (перевір GRANT у міграції).";
  }

  return fallback;
}

function logProductsDbError(context: string, error: PostgrestError): void {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  console.error(`[product.service] ${context}`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

function normalizeProductRow(raw: Record<string, unknown>): ProductRow {
  const priceRaw = raw.price;
  const price =
    typeof priceRaw === "number" && Number.isFinite(priceRaw)
      ? priceRaw
      : Number.parseFloat(String(priceRaw ?? "0"));
  const stockRaw = raw.stock;
  const stock =
    typeof stockRaw === "number" && Number.isFinite(stockRaw)
      ? Math.floor(stockRaw)
      : Number.parseInt(String(stockRaw ?? "0"), 10) || 0;

  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    name: String(raw.name ?? ""),
    description: raw.description == null || raw.description === "" ? null : String(raw.description),
    category: raw.category == null || raw.category === "" ? null : String(raw.category),
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    stock: Number.isFinite(stock) && stock >= 0 ? stock : 0,
    created_at: String(raw.created_at),
    updated_at: String(raw.updated_at),
  };
}

export async function getProducts(): Promise<ServiceResult<ProductRow[]>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    logProductsDbError("getProducts", error);
    return {
      ok: false,
      error: {
        code: "PRODUCT_LIST_FAILED",
        message: messageForProductsDbError(error, "Не вдалося завантажити товари."),
      },
    };
  }

  return {
    ok: true,
    data: (data ?? []).map((row) => normalizeProductRow(row as Record<string, unknown>)),
  };
}

export async function createProduct(
  input: CreateProductInput,
): Promise<ServiceResult<ProductRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  if (!input.name?.trim()) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Назва товару обовʼязкова." },
    };
  }

  const price = input.price ?? 0;
  const stockFloored = Math.max(0, Math.floor(Number(input.stock ?? 0)));
  if (!Number.isFinite(price) || price < 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Некоректна ціна." },
    };
  }
  if (!Number.isFinite(stockFloored)) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Некоректний залишок." },
    };
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      price,
      stock: stockFloored,
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    logProductsDbError("createProduct", error);
    return {
      ok: false,
      error: {
        code: "PRODUCT_CREATE_FAILED",
        message: messageForProductsDbError(error, "Не вдалося створити товар."),
      },
    };
  }

  return { ok: true, data: normalizeProductRow(data as Record<string, unknown>) };
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<ServiceResult<ProductRow>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const payload: Record<string, string | number | null> = {};
  if (input.name !== undefined) {
    payload.name = input.name.trim();
  }
  if (input.price !== undefined) {
    if (!Number.isFinite(input.price) || input.price < 0) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Некоректна ціна." },
      };
    }
    payload.price = input.price;
  }
  if (input.stock !== undefined) {
    const s = Math.max(0, Math.floor(Number(input.stock)));
    if (!Number.isFinite(s)) {
      return {
        ok: false,
        error: { code: "VALIDATION", message: "Некоректний залишок." },
      };
    }
    payload.stock = s;
  }
  if (input.category !== undefined) {
    payload.category = input.category?.trim() || null;
  }
  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }

  if (Object.keys(payload).length === 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Немає полів для оновлення." },
    };
  }

  if (typeof payload.name === "string" && !payload.name) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Назва товару не може бути порожньою." },
    };
  }

  const { supabase, userId } = ctx.data;
  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error || !data) {
    if (error) {
      logProductsDbError("updateProduct", error);
    }
    return {
      ok: false,
      error: {
        code: "PRODUCT_UPDATE_FAILED",
        message: error
          ? messageForProductsDbError(error, "Не вдалося оновити товар.")
          : "Не вдалося оновити товар.",
      },
    };
  }

  return { ok: true, data: normalizeProductRow(data as Record<string, unknown>) };
}

export async function deleteProduct(id: string): Promise<ServiceResult<{ id: string }>> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const { error } = await supabase.from("products").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    logProductsDbError("deleteProduct", error);
    return {
      ok: false,
      error: {
        code: "PRODUCT_DELETE_FAILED",
        message: messageForProductsDbError(error, "Не вдалося видалити товар."),
      },
    };
  }

  return { ok: true, data: { id } };
}

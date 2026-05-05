import { mapOrderRow } from "./order.service";
import { getAuthenticatedContext } from "./session";
import type {
  AppointmentRow,
  ClientRow,
  ExpenseRow,
  OrderRow,
  ServiceResult,
  ServiceRow,
} from "./types";

/** Дані для аналітики та дашборду (обмежені вибірки для продуктивності). */
export type AnalyticsBundle = {
  appointments: AppointmentRow[];
  clients: ClientRow[];
  services: ServiceRow[];
  orders: OrderRow[];
};

/** Бандл фінансів: те саме, що аналітика, плюс витрати (окремий запит на сторінці /finance). */
export type FinanceBundle = AnalyticsBundle & { expenses: ExpenseRow[] };

const APPOINTMENTS_LIMIT = 1500;
const CLIENTS_LIMIT = 2000;
const SERVICES_LIMIT = 500;
const ORDERS_LIMIT = 1500;

/**
 * Завантажує записи, клієнтів і послуги поточного користувача для графіків і зведень.
 */
export async function getAnalyticsBundle(): Promise<
  ServiceResult<AnalyticsBundle>
> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;

  const [aRes, cRes, sRes, oRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(APPOINTMENTS_LIMIT),
    supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(CLIENTS_LIMIT),
    supabase
      .from("services")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true })
      .limit(SERVICES_LIMIT),
    supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(ORDERS_LIMIT),
  ]);

  if (aRes.error || cRes.error || sRes.error || oRes.error) {
    return {
      ok: false,
      error: {
        code: "ANALYTICS_BUNDLE_FAILED",
        message: "Не вдалося завантажити дані для аналітики.",
      },
    };
  }

  return {
    ok: true,
    data: {
      appointments: (aRes.data ?? []) as AppointmentRow[],
      clients: (cRes.data ?? []) as ClientRow[],
      services: (sRes.data ?? []) as ServiceRow[],
      orders: (oRes.data ?? []).map((r) => mapOrderRow(r as Record<string, unknown>)),
    },
  };
}

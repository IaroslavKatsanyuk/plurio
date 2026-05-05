import { addDaysToYmdKey, dateKeyKyiv } from "@/lib/datetime-kyiv";
import { getAuthenticatedContext } from "./session";
import type {
  AppointmentRow,
  AppointmentStatus,
  ClientRow,
  ServiceResult,
  ServiceRow,
} from "./types";

export type DashboardMetrics = {
  clientsCount: number;
  servicesCount: number;
  appointmentsUpcomingCount: number;
  appointmentsTotalCount: number;
};

/** Найближчі записи для головної панелі. */
export type DashboardUpcomingItem = {
  id: string;
  starts_at: string;
  status: AppointmentStatus;
  title: string | null;
  clientLabel: string;
  serviceLabel: string | null;
};

export type NamedCountRow = { name: string; count: number };

export type DashboardHomePayload = DashboardMetrics & {
  upcoming: DashboardUpcomingItem[];
  topServicesThisMonth: NamedCountRow[];
  topClientsThisMonth: NamedCountRow[];
};

const RECENT_APPOINTMENTS_FOR_HOME = 800;

/** Aggregated dashboard metrics (counts without loading full lists). */
export async function getDashboardMetrics(): Promise<
  ServiceResult<DashboardMetrics>
> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const nowIso = new Date().toISOString();

  const [clientsRes, servicesRes, upcomingRes, totalRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", nowIso),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  if (clientsRes.error || servicesRes.error || upcomingRes.error || totalRes.error) {
    return {
      ok: false,
      error: {
        code: "DASHBOARD_METRICS_FAILED",
        message: "Не вдалося завантажити метрики.",
      },
    };
  }

  return {
    ok: true,
    data: {
      clientsCount: clientsRes.count ?? 0,
      servicesCount: servicesRes.count ?? 0,
      appointmentsUpcomingCount: upcomingRes.count ?? 0,
      appointmentsTotalCount: totalRes.count ?? 0,
    },
  };
}

function monthBoundsKyivFromToday(): { startKey: string; endKey: string } {
  const todayKey = dateKeyKyiv(new Date().toISOString());
  const [yy, mm] = todayKey.split("-");
  if (!yy || !mm) {
    return { startKey: todayKey, endKey: todayKey };
  }
  const startKey = `${yy}-${mm}-01`;
  let endKey = startKey;
  for (let i = 0; i < 40; i++) {
    const k = addDaysToYmdKey(startKey, i);
    if (!k.startsWith(`${yy}-${mm}`)) {
      break;
    }
    endKey = k;
  }
  return { startKey, endKey };
}

function sortNamedCounts(rows: NamedCountRow[], limit: number): NamedCountRow[] {
  return [...rows].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * Метрики плюс найближчі записи та топи за поточний місяць (календар Києва).
 */
export async function getDashboardHomeData(): Promise<
  ServiceResult<DashboardHomePayload>
> {
  const ctx = await getAuthenticatedContext();
  if (!ctx.ok) {
    return ctx;
  }

  const { supabase, userId } = ctx.data;
  const nowIso = new Date().toISOString();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    clientsRes,
    servicesRes,
    upcomingRes,
    totalRes,
    upcomingListRes,
    recentApptsRes,
    clientsListRes,
    servicesListRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", nowIso),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, title, client_id, service_id")
      .eq("user_id", userId)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(6),
    supabase
      .from("appointments")
      .select("*")
      .eq("user_id", userId)
      .gte("starts_at", sixMonthsAgo.toISOString())
      .order("starts_at", { ascending: false })
      .limit(RECENT_APPOINTMENTS_FOR_HOME),
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", userId)
      .limit(2000),
    supabase
      .from("services")
      .select("id, name")
      .eq("user_id", userId)
      .limit(500),
  ]);

  if (
    clientsRes.error ||
    servicesRes.error ||
    upcomingRes.error ||
    totalRes.error ||
    upcomingListRes.error ||
    recentApptsRes.error ||
    clientsListRes.error ||
    servicesListRes.error
  ) {
    return {
      ok: false,
      error: {
        code: "DASHBOARD_HOME_FAILED",
        message: "Не вдалося завантажити дані панелі.",
      },
    };
  }

  const clientsById = new Map(
    (clientsListRes.data ?? []).map((c) => [c.id, (c as ClientRow).name]),
  );
  const servicesById = new Map(
    (servicesListRes.data ?? []).map((s) => [s.id, (s as ServiceRow).name]),
  );

  const upcoming: DashboardUpcomingItem[] = (upcomingListRes.data ?? []).map(
    (row) => {
      const r = row as Pick<
        AppointmentRow,
        "id" | "starts_at" | "status" | "title" | "client_id" | "service_id"
      >;
      const clientLabel = r.client_id
        ? (clientsById.get(r.client_id) ?? "Клієнт")
        : "Без клієнта";
      const serviceLabel = r.service_id
        ? (servicesById.get(r.service_id) ?? null)
        : null;
      return {
        id: r.id,
        starts_at: r.starts_at,
        status: r.status,
        title: r.title,
        clientLabel,
        serviceLabel,
      };
    },
  );

  const { startKey: monthStartKey, endKey: monthEndKey } = monthBoundsKyivFromToday();
  const inMonth = (iso: string) => {
    const k = dateKeyKyiv(iso);
    return k >= monthStartKey && k <= monthEndKey;
  };

  const recentAppts = (recentApptsRes.data ?? []) as AppointmentRow[];
  const monthAppts = recentAppts.filter((a) => inMonth(a.starts_at));

  const serviceCounts = new Map<string, number>();
  for (const a of monthAppts) {
    if (a.status === "cancelled") {
      continue;
    }
    if (!a.service_id) {
      continue;
    }
    const name = servicesById.get(a.service_id) ?? "Послуга";
    serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
  }
  const topServicesThisMonth = sortNamedCounts(
    [...serviceCounts.entries()].map(([name, count]) => ({ name, count })),
    4,
  );

  const clientVisitCounts = new Map<string, number>();
  for (const a of monthAppts) {
    if (a.status !== "completed" || !a.client_id) {
      continue;
    }
    const name = clientsById.get(a.client_id) ?? "Клієнт";
    clientVisitCounts.set(name, (clientVisitCounts.get(name) ?? 0) + 1);
  }
  const topClientsThisMonth = sortNamedCounts(
    [...clientVisitCounts.entries()].map(([name, count]) => ({ name, count })),
    4,
  );

  return {
    ok: true,
    data: {
      clientsCount: clientsRes.count ?? 0,
      servicesCount: servicesRes.count ?? 0,
      appointmentsUpcomingCount: upcomingRes.count ?? 0,
      appointmentsTotalCount: totalRes.count ?? 0,
      upcoming,
      topServicesThisMonth,
      topClientsThisMonth,
    },
  };
}

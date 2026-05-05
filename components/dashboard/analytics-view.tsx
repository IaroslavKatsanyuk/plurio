"use client";

import type { LucideIcon } from "lucide-react";
import { Calendar, Star, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { addDaysToYmdKey, dateKeyKyiv, formatShortDayKyivFromYmd } from "@/lib/datetime-kyiv";
import { cn } from "@/lib/utils";
import type { AnalyticsBundle } from "@/services/analytics.service";
import type { AppointmentRow } from "@/services/types";

export const ANALYTICS_RANGES = [
  { label: "7 днів", days: 7 },
  { label: "30 днів", days: 30 },
  { label: "90 днів", days: 90 },
] as const;

export type AnalyticsRangeDays = (typeof ANALYTICS_RANGES)[number]["days"];

/** Near light-theme primary; Recharts does not read CSS variables directly. */
const CHART_PRIMARY = "#6d4bd9";
const CHART_GRID = "hsl(220 15% 90%)";
const CHART_TICK = "#64748b";

function todayYmdKyiv(): string {
  return dateKeyKyiv(new Date().toISOString());
}

function rangeKeys(days: number): { fromYmd: string; keys: string[] } {
  const toYmd = todayYmdKyiv();
  const fromYmd = addDaysToYmdKey(toYmd, -(days - 1));
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    keys.push(addDaysToYmdKey(fromYmd, i));
  }
  return { fromYmd, keys };
}

function appointmentDayKey(a: AppointmentRow): string {
  return dateKeyKyiv(a.starts_at);
}

function inYmdRange(dayKey: string, fromYmd: string, toYmd: string): boolean {
  return dayKey >= fromYmd && dayKey <= toYmd;
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  iconClassName,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[15px]",
            iconClassName,
          )}
        >
          <Icon aria-hidden />
        </div>
      </div>
      <p className="font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

type Props = {
  bundle: AnalyticsBundle;
  range: AnalyticsRangeDays;
};

export function AnalyticsView({ bundle, range }: Props) {
  const clientsById = useMemo(
    () => new Map(bundle.clients.map((c) => [c.id, c.name])),
    [bundle.clients],
  );
  const servicesById = useMemo(
    () => new Map(bundle.services.map((s) => [s.id, s])),
    [bundle.services],
  );

  const { fromYmd, keys } = useMemo(() => rangeKeys(range), [range]);
  const toYmd = todayYmdKyiv();

  const appointmentsInRange = useMemo(
    () =>
      bundle.appointments.filter((a) =>
        inYmdRange(appointmentDayKey(a), fromYmd, toYmd),
      ),
    [bundle.appointments, fromYmd, toYmd],
  );

  const ordersInRange = useMemo(
    () =>
      bundle.orders.filter((o) => inYmdRange(dateKeyKyiv(o.created_at), fromYmd, toYmd)),
    [bundle.orders, fromYmd, toYmd],
  );

  const revenueByDay = useMemo(() => {
    return keys.map((ymd) => {
      let revenue = 0;
      for (const a of bundle.appointments) {
        if (appointmentDayKey(a) !== ymd || a.status !== "completed") {
          continue;
        }
        const svc = a.service_id ? servicesById.get(a.service_id) : undefined;
        revenue += svc?.price ?? 0;
      }
      for (const o of bundle.orders) {
        if (dateKeyKyiv(o.created_at) !== ymd || o.status !== "paid") {
          continue;
        }
        revenue += o.total;
      }

      const [y, mo, d] = ymd.split("-").map(Number);
      const anchor = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
      const label =
        range <= 7
          ? formatShortDayKyivFromYmd(ymd)
          : anchor.toLocaleDateString("uk-UA", {
              timeZone: "Europe/Kyiv",
              day: "numeric",
              month: "short",
            });
      return { day: label, revenue };
    });
  }, [bundle.appointments, bundle.orders, keys, range, servicesById]);

  const totalRevenue = useMemo(
    () => revenueByDay.reduce((s, row) => s + row.revenue, 0),
    [revenueByDay],
  );

  const topServices = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointmentsInRange) {
      if (a.status === "cancelled" || !a.service_id) {
        continue;
      }
      const name = servicesById.get(a.service_id)?.name ?? "Послуга";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((x, y) => y[1] - x[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [appointmentsInRange, servicesById]);

  const topClientsBySpent = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointmentsInRange) {
      if (a.status !== "completed" || !a.client_id) {
        continue;
      }
      const name = clientsById.get(a.client_id) ?? "Клієнт";
      const svc = a.service_id ? servicesById.get(a.service_id) : undefined;
      map.set(name, (map.get(name) ?? 0) + (svc?.price ?? 0));
    }
    for (const o of ordersInRange) {
      if (o.status !== "paid") {
        continue;
      }
      const name = o.client_name.trim() || "Клієнт";
      map.set(name, (map.get(name) ?? 0) + o.total);
    }
    return [...map.entries()]
      .filter(([, spent]) => spent > 0)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 5)
      .map(([name, spent]) => ({ name, spent }));
  }, [appointmentsInRange, clientsById, ordersInRange, servicesById]);

  const doneCount = appointmentsInRange.filter((a) => a.status === "completed").length;
  const cancelledCount = appointmentsInRange.filter((a) => a.status === "cancelled").length;
  const allCount = appointmentsInRange.length;
  const convRate = allCount > 0 ? Math.round((doneCount / allCount) * 100) : 0;

  const newClients = useMemo(() => {
    return bundle.clients.filter((c) => {
      const k = dateKeyKyiv(c.created_at);
      return inYmdRange(k, fromYmd, toYmd);
    }).length;
  }, [bundle.clients, fromYmd, toYmd]);

  const maxSpent = topClientsBySpent[0]?.spent ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Виручка"
          value={`${totalRevenue.toLocaleString("uk-UA")} ₴`}
          sub={`за ${range} днів`}
          icon={TrendingUp}
          iconClassName="bg-primary/10 text-primary"
        />
        <MetricCard
          title="Конверсія"
          value={`${convRate}%`}
          sub={`${doneCount} виконано / ${cancelledCount} скасовано`}
          icon={Star}
          iconClassName="bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400"
        />
        <MetricCard
          title="Нових клієнтів"
          value={newClients}
          sub={`за ${range} днів`}
          icon={Users}
          iconClassName="bg-accent/10 text-accent-foreground"
        />
        <MetricCard
          title="Записів"
          value={allCount}
          sub={`за ${range} днів`}
          icon={Calendar}
          iconClassName="bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h2 className="mb-5 font-display text-lg font-bold">Виручка по днях</h2>
        <div className="h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueByDay} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="plurioAnalyticsRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: CHART_TICK }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_TICK }}
                axisLine={false}
                tickLine={false}
                width={50}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid hsl(220 15% 90%)",
                  borderRadius: 8,
                  color: "#0f172a",
                }}
                formatter={(v: number) => [`${Number(v).toLocaleString("uk-UA")} ₴`, "Виручка"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={CHART_PRIMARY}
                strokeWidth={2}
                fill="url(#plurioAnalyticsRev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-5 font-display text-lg font-bold">Топ послуги</h2>
          {topServices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Немає даних</p>
          ) : (
            <div className="h-[200px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServices} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: CHART_TICK }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fill: CHART_TICK }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid hsl(220 15% 90%)",
                      borderRadius: 8,
                      color: "#0f172a",
                    }}
                    formatter={(v: number) => [v, "Записів"]}
                  />
                  <Bar dataKey="count" fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <h2 className="mb-5 font-display text-lg font-bold">Топ клієнти</h2>
          {topClientsBySpent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Немає даних</p>
          ) : (
            <ul className="space-y-3">
              {topClientsBySpent.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center gap-3">
                  <span className="w-6 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {c.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(c.spent / maxSpent) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {c.spent.toLocaleString("uk-UA")} ₴
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

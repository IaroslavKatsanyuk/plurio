import Link from "next/link";
import { ArrowRight, BarChart2, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatTimeKyiv } from "@/lib/datetime-kyiv";
import { createClient } from "@/lib/supabase/server";
import { getDashboardHomeData } from "@/services/dashboard.service";
import type { AppointmentStatus } from "@/services/types";

function MetricCard({
  href,
  label,
  value,
  hint,
  accent,
}: {
  href: string;
  label: string;
  value: number | string;
  hint: string;
  accent: "primary" | "warning" | "accent" | "success";
}) {
  const bar = {
    primary: "bg-primary",
    warning: "bg-amber-400",
    accent: "bg-accent",
    success: "bg-emerald-500",
  }[accent];

  return (
    <Link href={href} className="block min-w-0">
      <Card className="flex h-full max-w-none gap-4 p-5 transition-shadow hover:shadow-md">
        <div className={cn("w-1.5 shrink-0 self-stretch rounded-full", bar)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="font-display mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        </div>
      </Card>
    </Link>
  );
}

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-gray-100 text-gray-800",
};

const STATUS_UK: Record<AppointmentStatus, string> = {
  scheduled: "Заплановано",
  confirmed: "Підтверджено",
  cancelled: "Скасовано",
  completed: "Завершено",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const homeResult = await getDashboardHomeData();
  const m = homeResult.ok
    ? homeResult.data
    : {
        clientsCount: 0,
        servicesCount: 0,
        appointmentsUpcomingCount: 0,
        appointmentsTotalCount: 0,
        upcoming: [],
        topServicesThisMonth: [],
        topClientsThisMonth: [],
      };

  const loading = !homeResult.ok;
  const dateSubtitle = format(new Date(), "EEEE, d MMMM yyyy", { locale: uk });

  return (
    <DashboardShell
      active="dashboard"
      userEmail={user.email ?? ""}
      title="Дашборд"
      subtitle={dateSubtitle}
    >
      {!homeResult.ok ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {homeResult.error.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          href="/appointments"
          label="Майбутні записи"
          value={loading ? "—" : m.appointmentsUpcomingCount}
          hint="Заплановані та підтверджені від зараз"
          accent="primary"
        />
        <MetricCard
          href="/appointments"
          label="Усього записів"
          value={loading ? "—" : m.appointmentsTotalCount}
          hint="Усі записи в календарі"
          accent="warning"
        />
        <MetricCard
          href="/clients"
          label="Клієнти"
          value={loading ? "—" : m.clientsCount}
          hint="База клієнтів"
          accent="accent"
        />
        <MetricCard
          href="/services"
          label="Послуги"
          value={loading ? "—" : m.servicesCount}
          hint="Каталог послуг"
          accent="success"
        />
      </div>

      {!loading && (m.topServicesThisMonth.length > 0 || m.topClientsThisMonth.length > 0) ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="max-w-none p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Топ послуги (місяць)</h2>
              <Link
                href="/analytics"
                className="flex items-center gap-1 text-sm font-medium text-primary transition hover:opacity-90"
              >
                <BarChart2 className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {m.topServicesThisMonth.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Немає даних</p>
            ) : (
              <ul className="space-y-2">
                {m.topServicesThisMonth.map((row, i) => {
                  const max = m.topServicesThisMonth[0]?.count ?? 1;
                  return (
                    <li key={`${row.name}-${i}`} className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="truncate font-medium text-foreground">{row.name}</span>
                          <span className="text-muted-foreground">{row.count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="max-w-none p-6">
            <h2 className="mb-1 text-lg font-semibold text-foreground">Топ клієнти (місяць)</h2>
            <p className="mb-4 text-xs text-muted-foreground">За кількістю завершених візитів.</p>
            {m.topClientsThisMonth.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Немає даних</p>
            ) : (
              <ul className="space-y-2">
                {m.topClientsThisMonth.map((row, i) => (
                  <li key={`${row.name}-${i}`} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      {row.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.name}</span>
                    <span className="text-sm font-semibold text-primary">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="max-w-none p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Найближчі записи</h2>
            <Link
              href="/appointments"
              className="flex items-center gap-1 text-sm font-medium text-primary transition hover:gap-2 hover:opacity-90"
            >
              Усі
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {!loading && m.upcoming.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Немає запланованих записів наперед.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(loading ? [] : m.upcoming).map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="h-8 w-1 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.clientLabel}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.serviceLabel ?? a.title ?? "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-foreground">{formatTimeKyiv(a.starts_at)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[a.status]}`}
                  >
                    {STATUS_UK[a.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="max-w-none p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Останні замовлення</h2>
            <Link
              href="/orders"
              className="flex items-center gap-1 text-sm font-medium text-primary transition hover:gap-2 hover:opacity-90"
            >
              Усі
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ShoppingBag className="mb-3 h-12 w-12 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">Замовлень ще немає</p>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

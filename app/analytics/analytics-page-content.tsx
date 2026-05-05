"use client";

import { useState } from "react";

import { ANALYTICS_RANGES, AnalyticsView, type AnalyticsRangeDays } from "@/components/dashboard/analytics-view";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { cn } from "@/lib/utils";
import type { AnalyticsBundle } from "@/services/analytics.service";

type Props = {
  userEmail: string;
  bundle: AnalyticsBundle;
};

export function AnalyticsPageContent({ userEmail, bundle }: Props) {
  const [range, setRange] = useState<AnalyticsRangeDays>(30);

  return (
    <DashboardShell
      active="analytics"
      userEmail={userEmail}
      title="Аналітика"
      subtitle="Статистика та звіти бізнесу"
      headerRight={
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {ANALYTICS_RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRange(r.days)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                range === r.days
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <AnalyticsView bundle={bundle} range={range} />
    </DashboardShell>
  );
}

import type { ReactNode } from "react";

import { DashboardNavbar, type DashboardNavActive } from "@/components/dashboard/navbar";

type Props = {
  active: DashboardNavActive;
  userEmail: string;
  title: string;
  /** Optional line under the page title (e.g. user email). */
  subtitle?: string;
  /** Кнопки справа від заголовка (наприклад «Створити запис»). */
  headerRight?: ReactNode;
  /** Renders below the navbar (e.g. inbox clear hook). */
  topSlot?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  active,
  userEmail,
  title,
  subtitle,
  headerRight,
  topSlot,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DashboardNavbar active={active} userEmail={userEmail} />
      <div className="min-h-0 md:pl-64">
        {topSlot}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            {headerRight ? <div className="flex shrink-0 flex-wrap items-center gap-2">{headerRight}</div> : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}

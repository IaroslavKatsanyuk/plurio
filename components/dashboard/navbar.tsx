"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PieChart,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { GlobalSearch } from "@/components/dashboard/global-search";
import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth.service";

export type DashboardNavActive =
  | "dashboard"
  | "appointments"
  | "orders"
  | "invoices"
  | "clients"
  | "services"
  | "products"
  | "analytics"
  | "finance"
  | "taxes"
  | "settings";

type Props = {
  active: DashboardNavActive;
  userEmail?: string | null;
};

const navItems = [
  { key: "dashboard" as const, href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { key: "appointments" as const, href: "/appointments", label: "Записи", icon: CalendarDays },
  { key: "orders" as const, href: "/orders", label: "Замовлення", icon: ShoppingCart },
  { key: "invoices" as const, href: "/invoices", label: "Інвойси", icon: FileText },
  { key: "clients" as const, href: "/clients", label: "Клієнти", icon: Users },
  { key: "services" as const, href: "/services", label: "Послуги", icon: BriefcaseBusiness },
  { key: "products" as const, href: "/products", label: "Товари", icon: Package },
  { key: "analytics" as const, href: "/analytics", label: "Аналітика", icon: PieChart },
  { key: "finance" as const, href: "/finance", label: "Фінанси", icon: Wallet },
  { key: "taxes" as const, href: "/taxes", label: "Податки", icon: Receipt },
  { key: "settings" as const, href: "/settings", label: "Налаштування", icon: Settings },
] as const;

function getInitials(email: string | null | undefined): string {
  const normalizedEmail = typeof email === "string" ? email : "";
  const local = normalizedEmail.split("@")[0]?.trim() ?? "";
  if (!local) {
    return "U";
  }
  const parts = local
    .split(/[._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return local.slice(0, 2).toUpperCase();
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("").slice(0, 2);
}

function SidebarNav({
  active,
  onNavigate,
}: {
  active: DashboardNavActive;
  onNavigate?: () => void;
}) {
  return (
    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {isActive ? <ChevronRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

type SidebarBodyProps = {
  active: DashboardNavActive;
  displayEmail: string;
  initials: string;
  inboxUnread: number | null;
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
};

function SidebarBody({
  active,
  displayEmail,
  initials,
  inboxUnread,
  onNavigate,
  showClose,
  onClose,
}: SidebarBodyProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-sidebar-border px-4 py-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-display truncate text-lg font-bold tracking-tight text-sidebar-foreground">
            Plurio
          </span>
        </Link>
        {showClose ? (
          <button
            type="button"
            aria-label="Закрити меню"
            onClick={onClose}
            className="rounded-md p-2 text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="px-3 pb-2 pt-1">
        <GlobalSearch variant="sidebar" />
      </div>

      <SidebarNav active={active} onNavigate={onNavigate} />

      <div className="mt-auto border-t border-sidebar-border px-3 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg px-1 py-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{displayEmail}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Власник</p>
          </div>
          <Link
            href="/appointments"
            onClick={onNavigate}
            className="relative shrink-0 rounded-md p-2 text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Записи та сповіщення"
            title="Записи"
          >
            <Bell className="h-4 w-4" aria-hidden />
            {inboxUnread != null && inboxUnread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {inboxUnread > 99 ? "99+" : inboxUnread}
              </span>
            ) : null}
          </Link>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border bg-transparent px-3 py-2.5 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Вийти
          </button>
        </form>
      </div>
    </>
  );
}

/** Лівий сайдбар + мобільне меню (як у референсі: темна навігація, не горизонтальний топбар). */
export function DashboardNavbar({ active, userEmail }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxUnread, setInboxUnread] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInbox() {
      try {
        const res = await fetch("/api/inbox");
        const json = (await res.json()) as { data?: { unreadCount: number } };
        if (!cancelled && res.ok && json.data) {
          setInboxUnread(json.data.unreadCount);
        }
      } catch {
        if (!cancelled) {
          setInboxUnread(null);
        }
      }
    }
    void loadInbox();
    function onInboxUpdated() {
      void loadInbox();
    }
    window.addEventListener("plurio:inbox-updated", onInboxUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("plurio:inbox-updated", onInboxUpdated);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const displayEmail =
    typeof userEmail === "string" && userEmail.trim() ? userEmail.trim() : "Користувач";
  const initials = getInitials(userEmail);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBody
          active={active}
          displayEmail={displayEmail}
          initials={initials}
          inboxUnread={inboxUnread}
        />
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-label="Відкрити меню"
            onClick={() => setMobileOpen(true)}
            className="rounded-md border border-border bg-card p-2 text-foreground shadow-sm transition hover:bg-muted"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <Link href="/dashboard" className="font-display truncate text-lg font-bold text-foreground">
            Plurio
          </Link>
        </div>
        <Link
          href="/appointments"
          className="relative rounded-md border border-border bg-card p-2 text-foreground shadow-sm transition hover:bg-muted"
          aria-label="Записи та сповіщення"
        >
          <Bell className="h-5 w-5" aria-hidden />
          {inboxUnread != null && inboxUnread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {inboxUnread > 99 ? "99+" : inboxUnread}
            </span>
          ) : null}
        </Link>
      </header>

      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Закрити меню"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={closeMobile}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(288px,90vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl md:hidden">
            <SidebarBody
              active={active}
              displayEmail={displayEmail}
              initials={initials}
              inboxUnread={inboxUnread}
              onNavigate={closeMobile}
              showClose
              onClose={closeMobile}
            />
          </aside>
        </>
      ) : null}
    </>
  );
}

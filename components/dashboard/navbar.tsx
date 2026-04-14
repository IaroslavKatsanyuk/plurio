"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth.service";

type Props = {
  active: "appointments" | "clients" | "services" | "settings";
  userEmail?: string | null;
};

const navItems = [
  { key: "clients", href: "/clients", label: "Клієнти", icon: Users },
  { key: "appointments", href: "/appointments", label: "Записи", icon: CalendarDays },
  { key: "services", href: "/services", label: "Послуги", icon: BriefcaseBusiness },
] as const;

export function DashboardNavbar({ active, userEmail }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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

  useEffect(() => {
    function handleDocumentClick() {
      setProfileOpen(false);
    }

    if (!profileOpen) {
      return;
    }

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [profileOpen]);

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

  const displayEmail = typeof userEmail === "string" && userEmail.trim() ? userEmail : "Користувач";
  const initials = getInitials(userEmail);

  const menuContent = (
    <>
      <nav className="space-y-1 px-3 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm transition hover:bg-violet-800/60",
                "gap-2",
                isActive ? "bg-violet-600/40 text-white" : "text-violet-100",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-violet-800/60 px-3 py-3">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-700/70 bg-violet-900/40 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-800/60"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Вийти
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="relative z-30">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-800/60 bg-gradient-to-b from-[#38106a] via-[#250c48] to-[#170a2d] px-3 py-2 text-violet-50 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={mobileOpen ? "Закрити меню" : "Відкрити меню"}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="rounded-md border border-violet-700/70 p-1.5 text-violet-200 transition hover:bg-violet-800/60 hover:text-violet-50"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <p className="text-sm font-semibold tracking-wide text-violet-100">Plurio</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/appointments"
            className="relative rounded-md border border-violet-700/70 p-1.5 text-violet-200 transition hover:bg-violet-800/60 hover:text-violet-50"
            aria-label="Записи та сповіщення"
            title="Записи"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {inboxUnread != null && inboxUnread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {inboxUnread > 99 ? "99+" : inboxUnread}
              </span>
            ) : null}
          </Link>
          <p className="hidden max-w-[160px] truncate text-xs text-violet-200 sm:block">{displayEmail}</p>
          <div className="relative">
            <button
              type="button"
              aria-label={`Профіль ${displayEmail}`}
              title={displayEmail}
              onClick={(event) => {
                event.stopPropagation();
                setProfileOpen((prev) => !prev);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]"
            >
              {initials}
            </button>
            {profileOpen ? (
              <div
                className="absolute top-[calc(100%+8px)] right-0 z-40 w-48 overflow-hidden rounded-xl border border-violet-800/70 bg-gradient-to-b from-[#38106a] via-[#250c48] to-[#170a2d] p-1 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-violet-800/60",
                    active === "settings" ? "bg-violet-600/40 text-white" : "text-violet-100",
                  )}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  Налаштування
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Закрити меню"
            className="fixed inset-0 z-20 bg-black/45"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute top-[calc(100%+8px)] left-0 z-30 flex h-[min(70vh,560px)] w-[320px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-violet-800/60 bg-gradient-to-b from-[#38106a] via-[#250c48] to-[#170a2d] text-violet-50 shadow-2xl">
            {menuContent}
          </aside>
        </>
      ) : null}
    </div>
  );
}

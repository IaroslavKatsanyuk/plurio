import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, LogOut, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/services/auth.service";

type Props = {
  active: "appointments" | "clients" | "services";
  userEmail: string;
};

export function DashboardNavbar({ active, userEmail }: Props) {
  return (
    <aside className="flex h-full min-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-violet-900/50 bg-gradient-to-b from-[#38106a] via-[#250c48] to-[#170a2d] text-violet-50 shadow-2xl lg:sticky lg:top-4">
      <div className="border-b border-violet-800/60 px-4 py-4">
        <p className="text-sm font-semibold tracking-wide text-violet-100">Plurio</p>
      </div>

      <nav className="space-y-1 px-3 py-3">
        <Link
          href="/clients"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-violet-800/60",
            active === "clients"
              ? "bg-violet-600/40 text-white"
              : "text-violet-100",
          )}
        >
          <Users className="h-4 w-4" />
          Клієнти
        </Link>
        <Link
          href="/appointments"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-violet-800/60",
            active === "appointments"
              ? "bg-violet-600/40 text-white"
              : "text-violet-100",
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Записи
        </Link>
        <Link
          href="/services"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-violet-800/60",
            active === "services"
              ? "bg-violet-600/40 text-white"
              : "text-violet-100",
          )}
        >
          <BriefcaseBusiness className="h-4 w-4" />
          Послуги
        </Link>
      </nav>

      <div className="mt-auto border-t border-violet-800/60 px-3 py-3">
        <div className="mb-3 rounded-lg bg-violet-900/50 px-3 py-2">
          <p className="text-xs text-violet-200">Профіль</p>
          <p className="truncate text-sm text-violet-50">{userEmail}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-700/70 bg-violet-900/40 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-800/60"
          >
            <LogOut className="h-4 w-4" />
            Вийти
          </button>
        </form>
      </div>
    </aside>
  );
}

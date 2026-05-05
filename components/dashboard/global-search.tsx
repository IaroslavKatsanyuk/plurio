"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Search, Users, X } from "lucide-react";

import { formatDateTimeKyiv } from "@/lib/datetime-kyiv";
import { cn } from "@/lib/utils";
import type { AppointmentRow, ClientRow, ServiceRow } from "@/services/types";

type SearchCache = {
  clients: ClientRow[];
  appointments: AppointmentRow[];
  services: ServiceRow[];
};

const appointmentStatusUk: Record<AppointmentRow["status"], string> = {
  scheduled: "Заплановано",
  confirmed: "Підтверджено",
  cancelled: "Скасовано",
  completed: "Завершено",
};

function clientMatchesQuery(c: ClientRow, q: string): boolean {
  const name = c.name.toLowerCase();
  const phone = (c.phone ?? "").toLowerCase();
  const tg = (c.telegram_username ?? "").toLowerCase();
  const email = (c.email ?? "").toLowerCase();
  return name.includes(q) || phone.includes(q) || tg.includes(q) || email.includes(q);
}

function appointmentMatchesQuery(
  a: AppointmentRow,
  q: string,
  clientName: string,
  serviceName: string,
): boolean {
  const title = (a.title ?? "").toLowerCase();
  const notes = (a.notes ?? "").toLowerCase();
  return (
    title.includes(q) ||
    notes.includes(q) ||
    clientName.includes(q) ||
    serviceName.includes(q)
  );
}

type GlobalSearchProps = {
  /** Кнопка-тригер у темному сайдбарі або на світлому тлі. */
  variant?: "sidebar" | "light";
};

export function GlobalSearch({ variant = "light" }: GlobalSearchProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [cache, setCache] = useState<SearchCache | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Same on server and first client paint; updated after mount to avoid hydration mismatch. */
  const [modKeyLabel, setModKeyLabel] = useState("Ctrl");

  const loadCache = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes, sRes] = await Promise.all([
        fetch("/api/clients"),
        fetch("/api/appointments"),
        fetch("/api/services"),
      ]);
      const cJson = (await cRes.json()) as { data?: ClientRow[] };
      const aJson = (await aRes.json()) as { data?: AppointmentRow[] };
      const sJson = (await sRes.json()) as { data?: ServiceRow[] };
      if (cRes.ok && aRes.ok && sRes.ok && cJson.data && aJson.data && sJson.data) {
        setCache({
          clients: cJson.data,
          appointments: aJson.data,
          services: sJson.data,
        });
      } else {
        setCache({ clients: [], appointments: [], services: [] });
      }
    } catch {
      setCache({ clients: [], appointments: [], services: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setModKeyLabel(/Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘" : "Ctrl");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      void loadCache();
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open, loadCache]);

  const { clientById, serviceById } = useMemo(() => {
    if (!cache) {
      return { clientById: new Map<string, ClientRow>(), serviceById: new Map<string, ServiceRow>() };
    }
    const cMap = new Map(cache.clients.map((c) => [c.id, c]));
    const sMap = new Map(cache.services.map((s) => [s.id, s]));
    return { clientById: cMap, serviceById: sMap };
  }, [cache]);

  const results = useMemo(() => {
    if (!cache || !query.trim()) {
      return { clients: [] as ClientRow[], appointments: [] as AppointmentRow[] };
    }
    const q = query.trim().toLowerCase();
    const clients = cache.clients.filter((c) => clientMatchesQuery(c, q)).slice(0, 6);
    const appointments = cache.appointments
      .filter((a) => {
        const cName = (a.client_id && clientById.get(a.client_id)?.name) || "";
        const sName =
          (a.service_id && serviceById.get(a.service_id)?.name) || "";
        return appointmentMatchesQuery(
          a,
          q,
          cName.toLowerCase(),
          sName.toLowerCase(),
        );
      })
      .slice(0, 6);
    return { clients, appointments };
  }, [cache, query, clientById, serviceById]);

  const total = results.clients.length + results.appointments.length;

  function go(path: string) {
    router.push(path);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition",
          variant === "sidebar"
            ? "border-sidebar-border bg-sidebar-accent/80 text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            : "border-border bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Відкрити пошук"
      >
        <Search className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 flex-1 truncate">Пошук…</span>
        <kbd
          className={cn(
            "hidden shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline",
            variant === "sidebar"
              ? "border-sidebar-border bg-sidebar-accent text-sidebar-foreground/80"
              : "border-border bg-background text-muted-foreground",
          )}
        >
          {modKeyLabel}K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[45] flex items-start justify-center bg-black/50 pt-16 sm:pt-24"
          role="dialog"
          aria-modal="true"
          aria-label="Пошук"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Клієнти, записи, послуги…"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setQuery("")}
                  aria-label="Очистити"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain px-1 py-2">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Завантаження…</p>
              ) : null}
              {!loading && query.trim() && total === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Нічого не знайдено</p>
              ) : null}
              {!loading && !query.trim() ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Введіть запит або натисніть {modKeyLabel}K
                </p>
              ) : null}

              {results.clients.length > 0 ? (
                <div>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Клієнти
                  </p>
                  {results.clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => go("/clients")}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-foreground transition hover:bg-muted"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                        {c.name[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        {c.phone ? (
                          <p className="truncate text-xs text-muted-foreground">{c.phone}</p>
                        ) : null}
                      </div>
                      <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}

              {results.appointments.length > 0 ? (
                <div>
                  <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Записи
                  </p>
                  {results.appointments.map((a) => {
                    const cName =
                      (a.client_id && clientById.get(a.client_id)?.name) || "Без клієнта";
                    const sName =
                      (a.service_id && serviceById.get(a.service_id)?.name) || "—";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => go("/appointments")}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-foreground transition hover:bg-muted"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent-foreground">
                          <Calendar className="size-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {sName} · {formatDateTimeKyiv(a.starts_at)} ·{" "}
                            {appointmentStatusUk[a.status]}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

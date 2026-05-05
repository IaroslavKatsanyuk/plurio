"use client";

import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { Calendar, ChevronDown, Search } from "lucide-react";
import type {
  ClientRow,
  AppointmentRow,
  AppointmentStatus,
  ServiceRow,
} from "@/services/types";
import { ExportButton, type CsvColumn } from "@/components/dashboard/export-button";
import { Button } from "@/components/ui/button";
import { DateTimePickerInput } from "@/components/ui/date-time-picker-input";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  addDaysToYmdKey,
  dateKeyKyiv,
  formatDateTimeKyiv,
  formatDateTitleKyivFromYmd,
  formatShortDayKyivFromYmd,
  formatTimeKyiv,
  mondayKyivDateKey,
} from "@/lib/datetime-kyiv";
import type { TelegramBookingNotifyMeta } from "@/lib/telegram-immediate-booking";
import { cn } from "@/lib/utils";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";

type Props = {
  initialAppointments: AppointmentRow[];
  clients: ClientRow[];
  services: ServiceRow[];
};

export type AppointmentsCrudRef = {
  openCreateModal: () => void;
};

type CreateForm = {
  title: string;
  client_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
};

type ViewMode = "table" | "day" | "week";

const statuses: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
];

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Заплановано",
  confirmed: "Підтверджено",
  cancelled: "Скасовано",
  completed: "Завершено",
};

function defaultForm(): CreateForm {
  return {
    title: "",
    client_id: "",
    service_id: "",
    starts_at: "",
    ends_at: "",
    status: "scheduled",
  };
}

/** Local YYYY-MM-DDTHH:mm for datetime inputs (must not use UTC slice — parses as local). */
function toLocalDateTimeInputValue(isoOrTimestamp: string): string {
  const d = new Date(isoOrTimestamp);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function getClientLabel(clients: ClientRow[], clientId: string): string {
  if (!clientId) {
    return "Без клієнта";
  }
  return clients.find((client) => client.id === clientId)?.name ?? clientId;
}

function getServiceLabel(services: ServiceRow[], serviceId: string): string {
  if (!serviceId) {
    return "Без послуги";
  }
  return services.find((service) => service.id === serviceId)?.name ?? serviceId;
}

function statusBadgeClass(status: AppointmentStatus): string {
  if (status === "scheduled") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "confirmed") {
    return "bg-green-100 text-green-800";
  }
  if (status === "cancelled") {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-800";
}

function DraggableAppointment({
  row,
  clientName,
}: {
  row: AppointmentRow;
  clientName: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: row.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
      className="rounded-lg border border-input bg-muted/50 px-3 py-2"
      {...listeners}
      {...attributes}
    >
      <p className="font-medium">{row.title ?? "Без назви"}</p>
      <p className="text-xs text-muted-foreground">
        {formatTimeKyiv(row.starts_at)}
        {" – "}
        {formatTimeKyiv(row.ends_at)}
      </p>
      <p className="text-xs text-muted-foreground">{clientName ?? "Без клієнта"}</p>
      <span
        className={cn(
          "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
          statusBadgeClass(row.status),
        )}
      >
        {statusLabels[row.status]}
      </span>
    </div>
  );
}

function DroppableDayColumn({
  dayKey,
  title,
  rows,
  clientMap,
}: {
  dayKey: string;
  title: string;
  rows: AppointmentRow[];
  clientMap: Map<string, string>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `day:${dayKey}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border p-3 transition",
        isOver
          ? "border-primary bg-primary/10  "
          : "border-border bg-muted/40",
      )}
    >
      <h3 className="mb-2 font-medium text-foreground">{title}</h3>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id}>
            <DraggableAppointment
              row={row}
              clientName={row.client_id ? (clientMap.get(row.client_id) ?? null) : null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

export const AppointmentsCrud = forwardRef<AppointmentsCrudRef, Props>(function AppointmentsCrud(
  { initialAppointments, clients, services },
  ref,
) {
  const [rows, setRows] = useState<AppointmentRow[]>(initialAppointments);
  const [form, setForm] = useState<CreateForm>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramInfo, setTelegramInfo] = useState<{
    tone: "ok" | "warn";
    text: string;
  } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useImperativeHandle(ref, () => ({
    openCreateModal: () => {
      setEditingId(null);
      setForm(defaultForm());
      setError(null);
      setIsCreateOpen(true);
    },
  }));

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  const exportColumns = useMemo<CsvColumn<AppointmentRow>[]>(
    () => [
      { label: "ID", value: (r) => r.id },
      { label: "Назва", value: (r) => r.title ?? "" },
      {
        label: "Клієнт",
        value: (r) => (r.client_id ? (clientMap.get(r.client_id) ?? "") : ""),
      },
      {
        label: "Телефон",
        value: (r) => {
          if (!r.client_id) {
            return "";
          }
          return clients.find((c) => c.id === r.client_id)?.phone ?? "";
        },
      },
      {
        label: "Послуга",
        value: (r) => (r.service_id ? (serviceMap.get(r.service_id)?.name ?? "") : ""),
      },
      { label: "Початок", value: (r) => formatDateTimeKyiv(r.starts_at) },
      { label: "Кінець", value: (r) => formatDateTimeKyiv(r.ends_at) },
      { label: "Статус", value: (r) => statusLabels[r.status] },
    ],
    [clientMap, serviceMap, clients],
  );

  function applyServiceDuration(startsAt: string, serviceId: string): string {
    if (!startsAt || !serviceId) {
      return "";
    }
    const service = serviceMap.get(serviceId);
    if (!service) {
      return "";
    }
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) {
      return "";
    }
    const end = new Date(start.getTime() + service.duration_minutes * 60 * 1000);
    // Full ISO — slicing drops "Z" and breaks: "T07:00" parses as local, not UTC.
    return end.toISOString();
  }

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (q) {
        const clientName = row.client_id ? (clientMap.get(row.client_id) ?? "").toLowerCase() : "";
        const phone = row.client_id
          ? (clients.find((c) => c.id === row.client_id)?.phone ?? "").toLowerCase()
          : "";
        const serviceName = row.service_id
          ? (serviceMap.get(row.service_id)?.name ?? "").toLowerCase()
          : "";
        const title = (row.title ?? "").toLowerCase();
        const hay = `${clientName} ${phone} ${serviceName} ${title}`;
        if (!hay.includes(q)) {
          return false;
        }
      }
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }
      const start = new Date(row.starts_at);
      if (fromDate) {
        const from =
          fromDate.length > 10
            ? new Date(fromDate)
            : new Date(`${fromDate}T00:00:00`);
        if (!Number.isNaN(from.getTime()) && start < from) {
          return false;
        }
      }
      if (toDate) {
        const to =
          toDate.length > 10 ? new Date(toDate) : new Date(`${toDate}T23:59:59`);
        if (!Number.isNaN(to.getTime()) && start > to) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, fromDate, toDate, searchQuery, clientMap, serviceMap, clients]);

  const dayBuckets = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    filteredRows.forEach((row) => {
      const key = dateKeyKyiv(row.starts_at);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => ({
        date,
        rows: list.sort(
          (x, y) => new Date(x.starts_at).getTime() - new Date(y.starts_at).getTime(),
        ),
      }));
  }, [filteredRows]);

  const weekBuckets = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    filteredRows.forEach((row) => {
      const key = mondayKyivDateKey(row.starts_at);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, list]) => ({
        weekStart,
        rows: list.sort(
          (x, y) => new Date(x.starts_at).getTime() - new Date(y.starts_at).getTime(),
        ),
      }));
  }, [filteredRows]);

  async function onCreate() {
    if (!form.starts_at || !form.service_id) {
      setError("Оберіть послугу та початок запису.");
      return;
    }
    const autoEndsAt = applyServiceDuration(form.starts_at, form.service_id);
    if (!autoEndsAt) {
      setError("Не вдалося розрахувати кінець запису за тривалістю послуги.");
      return;
    }
    setPending(true);
    setError(null);
    setTelegramInfo(null);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || null,
          client_id: form.client_id || null,
          service_id: form.service_id || null,
          starts_at: new Date(form.starts_at).toISOString(),
          ends_at: autoEndsAt,
          status: form.status,
        }),
      });
      const json = (await response.json()) as
        | {
            data: AppointmentRow;
            meta?: { telegramNotify: TelegramBookingNotifyMeta };
          }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося створити запис.");
        return;
      }
      const tg = json.meta?.telegramNotify;
      if (tg) {
        setTelegramInfo({
          tone: tg.status === "sent" ? "ok" : "warn",
          text: tg.message,
        });
      }
      setRows((prev) => [json.data, ...prev]);
      setForm(defaultForm());
      setIsCreateOpen(false);
    } finally {
      setPending(false);
    }
  }

  async function onSaveForm() {
    if (editingId) {
      if (!form.starts_at || !form.service_id) {
        setError("Оберіть послугу та початок запису.");
        return;
      }
      const autoEndsAt = applyServiceDuration(form.starts_at, form.service_id);
      if (!autoEndsAt) {
        setError("Не вдалося розрахувати кінець запису за тривалістю послуги.");
        return;
      }
      setPending(true);
      setError(null);
      try {
        const response = await fetch(`/api/appointments/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "full",
            title: form.title || null,
            client_id: form.client_id || null,
            service_id: form.service_id || null,
            starts_at: new Date(form.starts_at).toISOString(),
            ends_at: autoEndsAt,
            status: form.status,
          }),
        });
        const json = (await response.json()) as
          | { data: AppointmentRow }
          | { error: { message: string } };
        if (!response.ok || !("data" in json)) {
          setError("error" in json ? json.error.message : "Не вдалося оновити запис.");
          return;
        }
        setRows((prev) => prev.map((row) => (row.id === editingId ? json.data : row)));
        setForm(defaultForm());
        setEditingId(null);
      } finally {
        setPending(false);
      }
      return;
    }
    await onCreate();
  }

  async function onDelete(id: string) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message?: string } };
        setError(json.error?.message ?? "Не вдалося видалити запис.");
        return;
      }
      setRows((prev) => prev.filter((row) => row.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setForm(defaultForm());
      }
    } finally {
      setPending(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || !overId.startsWith("day:")) {
      return;
    }

    const row = rows.find((item) => item.id === activeId);
    if (!row) {
      return;
    }

    const targetDate = overId.replace("day:", "");
    const oldStart = new Date(row.starts_at);
    const oldEnd = new Date(row.ends_at);
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    const [year, month, day] = targetDate.split("-").map(Number);
    const newStart = new Date(year, month - 1, day);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const newEnd = new Date(newStart.getTime() + durationMs);

    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/appointments/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          starts_at: newStart.toISOString(),
          ends_at: newEnd.toISOString(),
        }),
      });
      const json = (await response.json()) as
        | { data: AppointmentRow }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося перенести запис.");
        return;
      }
      setRows((prev) => prev.map((item) => (item.id === row.id ? json.data : item)));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Створення запису"
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Назва
            <Input
              placeholder="Назва"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Клієнт
            <div className="relative">
              <select
                value={form.client_id}
                onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                title={getClientLabel(clients, form.client_id)}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm leading-none text-foreground"
              >
                <option value="">Без клієнта</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Послуга
            <div className="relative">
              <select
                value={form.service_id}
                onChange={(e) =>
                  setForm((prev) => {
                    const serviceId = e.target.value;
                    const nextEndsAt = applyServiceDuration(prev.starts_at, serviceId);
                    return {
                      ...prev,
                      service_id: serviceId,
                      ends_at: nextEndsAt,
                    };
                  })
                }
                title={getServiceLabel(services, form.service_id)}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm leading-none text-foreground"
              >
                <option value="">Без послуги</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} хв)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Початок
            <DateTimePickerInput
              value={form.starts_at}
              onChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  starts_at: nextValue,
                  ends_at: applyServiceDuration(nextValue, prev.service_id),
                }))
              }
              placeholder="Початок"
              disablePastDays
              calendarPlacement="above"
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Статус
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as AppointmentStatus,
                  }))
                }
                title={statusLabels[form.status]}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm leading-none text-foreground"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void onCreate()} disabled={pending}>
            Створити запис
          </Button>
        </div>
      </Modal>

      <Modal
        open={editingId !== null}
        onClose={() => {
          setEditingId(null);
          setForm(defaultForm());
          setError(null);
        }}
        title="Редагування запису"
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-muted-foreground">
            Назва
            <Input
              placeholder="Назва"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Клієнт
            <div className="relative">
              <select
                value={form.client_id}
                onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                title={getClientLabel(clients, form.client_id)}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm leading-none text-foreground"
              >
                <option value="">Без клієнта</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Послуга
            <div className="relative">
              <select
                value={form.service_id}
                onChange={(e) =>
                  setForm((prev) => {
                    const serviceId = e.target.value;
                    const nextEndsAt = applyServiceDuration(prev.starts_at, serviceId);
                    return {
                      ...prev,
                      service_id: serviceId,
                      ends_at: nextEndsAt,
                    };
                  })
                }
                title={getServiceLabel(services, form.service_id)}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm leading-none text-foreground"
              >
                <option value="">Без послуги</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} хв)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Початок
            <DateTimePickerInput
              value={form.starts_at}
              onChange={(nextValue) =>
                setForm((prev) => ({
                  ...prev,
                  starts_at: nextValue,
                  ends_at: applyServiceDuration(nextValue, prev.service_id),
                }))
              }
              placeholder="Початок"
              disablePastDays
              calendarPlacement="above"
            />
          </label>
          <label className="grid gap-1 text-sm text-muted-foreground">
            Статус
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as AppointmentStatus,
                  }))
                }
                title={statusLabels[form.status]}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-3 pr-10 text-sm leading-none text-foreground"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void onSaveForm()} disabled={pending}>
            Зберегти зміни
          </Button>
          <Button
            type="button"
            variant="outline"
            className="ml-2"
            onClick={() => {
              setEditingId(null);
              setForm(defaultForm());
              setError(null);
            }}
          >
            Скасувати
          </Button>
        </div>
      </Modal>

      <section className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-semibold text-foreground">Список записів</h2>
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton data={filteredRows} columns={exportColumns} filename="appointments" />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                Таблиця
              </Button>
              <Button
                type="button"
                variant={viewMode === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("day")}
              >
                День
              </Button>
              <Button
                type="button"
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Тиждень
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Пошук за клієнтом, послугою, телефоном..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Пошук записів"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Статус
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | AppointmentStatus)
                  }
                  title="Фільтр за статусом"
                  className="h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-muted/30 px-3 pr-10 text-sm leading-none text-foreground"
                >
                  <option value="all">Усі статуси</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              Від дати
              <div className="relative">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="date"
                  className="pl-9"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              До дати
              <div className="relative">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="date"
                  className="pl-9"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </label>
          </div>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {telegramInfo ? (
          <p
            className={cn(
              "mb-3 text-sm",
              telegramInfo.tone === "ok"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-amber-800 dark:text-amber-300",
            )}
            role="status"
          >
            {telegramInfo.text}
          </p>
        ) : null}

        {viewMode === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ID
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Назва
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Клієнт
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Послуга
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Початок
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Кінець
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Статус
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-14 text-center text-sm text-muted-foreground">
                      Записів не знайдено за поточними фільтрами.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.title ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {row.client_id ? (clientMap.get(row.client_id) ?? row.client_id) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {row.service_id ? (serviceMap.get(row.service_id)?.name ?? row.service_id) : "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-foreground">
                        {formatDateTimeKyiv(row.starts_at)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                        {formatDateTimeKyiv(row.ends_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            statusBadgeClass(row.status),
                          )}
                        >
                          {statusLabels[row.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsCreateOpen(false);
                              setEditingId(row.id);
                              setForm({
                                title: row.title ?? "",
                                client_id: row.client_id ?? "",
                                service_id: row.service_id ?? "",
                                starts_at: toLocalDateTimeInputValue(row.starts_at),
                                ends_at: toLocalDateTimeInputValue(row.ends_at),
                                status: row.status,
                              });
                              setError(null);
                            }}
                            disabled={pending}
                          >
                            Редагувати
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => void onDelete(row.id)}
                            disabled={pending}
                          >
                            Видалити
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        <DndContext onDragEnd={(event) => void onDragEnd(event)}>
          {viewMode === "day" ? (
            <div className="space-y-3">
              {dayBuckets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Немає записів за фільтром.</p>
              ) : (
                dayBuckets.map((bucket) => (
                  <DroppableDayColumn
                    key={bucket.date}
                    dayKey={bucket.date}
                    title={formatDateTitleKyivFromYmd(bucket.date)}
                    rows={bucket.rows}
                    clientMap={clientMap}
                  />
                ))
              )}
            </div>
          ) : null}

          {viewMode === "week" ? (
            <div className="space-y-3">
              {weekBuckets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Немає записів за фільтром.</p>
              ) : (
                weekBuckets.map((bucket) => {
                  const days = Array.from({ length: 7 }, (_, i) =>
                    addDaysToYmdKey(bucket.weekStart, i),
                  );
                  return (
                    <div
                      key={bucket.weekStart}
                      className="rounded-xl border border-border bg-muted/30 p-3"
                    >
                      <h3 className="mb-2 font-medium">
                        Тиждень від {formatDateTitleKyivFromYmd(bucket.weekStart)}
                      </h3>
                      <div className="grid gap-2 lg:grid-cols-7">
                        {days.map((dayKey) => {
                          const dayRows = bucket.rows.filter(
                            (row) => dateKeyKyiv(row.starts_at) === dayKey,
                          );
                          return (
                            <DroppableDayColumn
                              key={dayKey}
                              dayKey={dayKey}
                              title={formatShortDayKyivFromYmd(dayKey)}
                              rows={dayRows}
                              clientMap={clientMap}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </DndContext>
      </section>
    </div>
  );
});

"use client";

import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import type {
  ClientRow,
  AppointmentRow,
  AppointmentStatus,
  ServiceRow,
} from "@/services/types";
import { Button } from "@/components/ui/button";
import { DateTimePickerInput } from "@/components/ui/date-time-picker-input";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

type Props = {
  initialAppointments: AppointmentRow[];
  clients: ClientRow[];
  services: ServiceRow[];
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

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
    return "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300";
  }
  if (status === "confirmed") {
    return "bg-violet-200 text-violet-800 dark:bg-violet-900 dark:text-violet-200";
  }
  if (status === "cancelled") {
    return "bg-violet-300 text-violet-900 dark:bg-violet-800 dark:text-violet-100";
  }
  return "bg-violet-100 text-violet-700 dark:bg-violet-900/70 dark:text-violet-300";
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
      className="rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2"
      {...listeners}
      {...attributes}
    >
      <p className="font-medium">{row.title ?? "Без назви"}</p>
      <p className="text-xs text-violet-500">
        {new Date(row.starts_at).toLocaleTimeString("uk-UA", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" – "}
        {new Date(row.ends_at).toLocaleTimeString("uk-UA", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p className="text-xs text-violet-500">{clientName ?? "Без клієнта"}</p>
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
          ? "border-violet-500 bg-violet-100 dark:border-violet-400 dark:bg-violet-900/40"
          : "border-violet-800/70 bg-violet-950/20",
      )}
    >
      <h3 className="mb-2 font-medium text-violet-100">{title}</h3>
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

export function AppointmentsCrud({ initialAppointments, clients, services }: Props) {
  const [rows, setRows] = useState<AppointmentRow[]>(initialAppointments);
  const [form, setForm] = useState<CreateForm>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState<"all" | AppointmentStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );
  const serviceMap = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
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
    return rows.filter((row) => {
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
  }, [rows, statusFilter, fromDate, toDate]);

  const dayBuckets = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    filteredRows.forEach((row) => {
      const key = toLocalDateKey(new Date(row.starts_at));
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
      const date = new Date(row.starts_at);
      const day = date.getDay() || 7;
      const monday = new Date(date);
      monday.setDate(date.getDate() - (day - 1));
      monday.setHours(0, 0, 0, 0);
      const key = toLocalDateKey(monday);
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
        | { data: AppointmentRow }
        | { error: { message: string } };
      if (!response.ok || !("data" in json)) {
        setError("error" in json ? json.error.message : "Не вдалося створити запис.");
        return;
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
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setEditingId(null);
            setForm(defaultForm());
            setError(null);
            setIsCreateOpen(true);
          }}
        >
          Створити запис
        </Button>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Створення запису"
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm text-violet-200">
            Назва
            <Input
              placeholder="Назва"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
            Клієнт
            <div className="relative">
              <select
                value={form.client_id}
                onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                title={getClientLabel(clients, form.client_id)}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm leading-none text-violet-100"
              >
                <option value="">Без клієнта</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
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
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm leading-none text-violet-100"
              >
                <option value="">Без послуги</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} хв)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
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
            />
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
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
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm leading-none text-violet-100"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200" />
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
          <label className="grid gap-1 text-sm text-violet-200">
            Назва
            <Input
              placeholder="Назва"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
            Клієнт
            <div className="relative">
              <select
                value={form.client_id}
                onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
                title={getClientLabel(clients, form.client_id)}
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm leading-none text-violet-100"
              >
                <option value="">Без клієнта</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
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
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm leading-none text-violet-100"
              >
                <option value="">Без послуги</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} ({service.duration_minutes} хв)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200" />
            </div>
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
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
            />
          </label>
          <label className="grid gap-1 text-sm text-violet-200">
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
                className="h-10 w-full min-w-0 appearance-none rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm leading-none text-violet-100"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-200" />
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

      <section className="rounded-2xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-4 text-violet-50">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-violet-50">
            Список записів
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "outline"}
              onClick={() => setViewMode("table")}
            >
              Таблиця
            </Button>
            <Button
              type="button"
              variant={viewMode === "day" ? "default" : "outline"}
              onClick={() => setViewMode("day")}
            >
              День
            </Button>
            <Button
              type="button"
              variant={viewMode === "week" ? "default" : "outline"}
              onClick={() => setViewMode("week")}
            >
              Тиждень
            </Button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | AppointmentStatus)
            }
            className="h-10 rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 text-sm leading-none text-violet-100"
          >
            <option value="all">Усі статуси</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <DateTimePickerInput
            value={fromDate}
            onChange={(nextValue) => setFromDate(nextValue)}
            placeholder="Від дати"
          />
          <DateTimePickerInput
            value={toDate}
            onChange={(nextValue) => setToDate(nextValue)}
            placeholder="До дати"
          />
        </div>

        {error ? (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        {viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-violet-800/70">
                  <th className="px-3 py-2 text-left font-medium">ID</th>
                  <th className="px-3 py-2 text-left font-medium">Назва</th>
                  <th className="px-3 py-2 text-left font-medium">Клієнт</th>
                  <th className="px-3 py-2 text-left font-medium">Послуга</th>
                  <th className="px-3 py-2 text-left font-medium">Початок</th>
                  <th className="px-3 py-2 text-left font-medium">Кінець</th>
                  <th className="px-3 py-2 text-left font-medium">Статус</th>
                  <th className="px-3 py-2 text-left font-medium">Дії</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-violet-100 dark:border-violet-900"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{row.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{row.title ?? "—"}</td>
                    <td className="px-3 py-2">
                      {row.client_id ? (clientMap.get(row.client_id) ?? row.client_id) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.service_id ? (serviceMap.get(row.service_id)?.name ?? row.service_id) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(row.starts_at).toLocaleString("uk-UA")}
                    </td>
                    <td className="px-3 py-2">
                      {new Date(row.ends_at).toLocaleString("uk-UA")}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          statusBadgeClass(row.status),
                        )}
                      >
                        {statusLabels[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
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
                          className="border-amber-300/80 bg-amber-500/20 text-amber-100 hover:bg-amber-500/35 hover:text-amber-50"
                        >
                          Редагувати
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void onDelete(row.id)}
                          disabled={pending}
                          className="border-red-300/80 bg-red-500/20 text-red-100 hover:bg-red-500/35 hover:text-red-50"
                        >
                          Видалити
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <DndContext onDragEnd={(event) => void onDragEnd(event)}>
          {viewMode === "day" ? (
            <div className="space-y-3">
              {dayBuckets.length === 0 ? (
                <p className="text-sm text-violet-500">Немає записів за фільтром.</p>
              ) : (
                dayBuckets.map((bucket) => (
                  <DroppableDayColumn
                    key={bucket.date}
                    dayKey={bucket.date}
                    title={new Date(`${bucket.date}T00:00:00`).toLocaleDateString("uk-UA")}
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
                <p className="text-sm text-violet-500">Немає записів за фільтром.</p>
              ) : (
                weekBuckets.map((bucket) => {
                  const weekStart = new Date(`${bucket.weekStart}T00:00:00`);
                  const days = Array.from({ length: 7 }, (_, i) => {
                    const day = new Date(weekStart);
                    day.setDate(weekStart.getDate() + i);
                    return day;
                  });
                  return (
                    <div
                      key={bucket.weekStart}
                      className="rounded-xl border border-violet-800/70 bg-violet-950/30 p-3"
                    >
                      <h3 className="mb-2 font-medium">
                        Тиждень від {weekStart.toLocaleDateString("uk-UA")}
                      </h3>
                      <div className="grid gap-2 lg:grid-cols-7">
                        {days.map((day) => {
                          const dayKey = toLocalDateKey(day);
                          const dayRows = bucket.rows.filter(
                            (row) => toLocalDateKey(new Date(row.starts_at)) === dayKey,
                          );
                          return (
                            <DroppableDayColumn
                              key={dayKey}
                              dayKey={dayKey}
                              title={day.toLocaleDateString("uk-UA", {
                                weekday: "short",
                                day: "2-digit",
                                month: "2-digit",
                              })}
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
}

"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { uk } from "date-fns/locale";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  mode?: "date" | "datetime";
};

function splitDateTime(value: string): { datePart: string; timePart: string } {
  if (!value) {
    return { datePart: "", timePart: "" };
  }
  const [datePart, timePartRaw] = value.split("T");
  const timePart = (timePartRaw ?? "").slice(0, 5);
  return { datePart: datePart ?? "", timePart };
}

function toDateTimeLocalValue(datePart: string, timePart: string): string {
  if (!datePart || !timePart) {
    return "";
  }
  return `${datePart}T${timePart}`;
}

function parseDateOnly(value: string): Date | null {
  if (!value) {
    return null;
  }
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function toDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateTimePickerInput({
  id,
  value,
  onChange,
  placeholder = "Обери дату та час",
  className,
  mode = "datetime",
}: Props) {
  const [open, setOpen] = useState(false);
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parts = splitDateTime(value);
    setDatePart(parts.datePart);
    setTimePart(parts.timePart);
  }, [value]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const displayValue = useMemo(() => {
    if (!value) {
      return "";
    }
    if (mode === "date") {
      const [datePartOnly] = value.split("T");
      if (!datePartOnly) {
        return "";
      }
      const date = new Date(`${datePartOnly}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleDateString("uk-UA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("uk-UA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [value]);

  const selectedDate = useMemo(() => parseDateOnly(datePart), [datePart]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-left text-sm text-violet-100 outline-none transition hover:bg-violet-900/60 focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <span className={cn(!displayValue ? "text-violet-400" : undefined)}>
          {displayValue || placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-violet-300" />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-full rounded-xl border border-violet-800/70 bg-gradient-to-b from-[#2a1050] to-[#170a2d] p-3 shadow-2xl">
          <div className="grid gap-3">
            <Calendar
              mode="single"
              locale={uk}
              selected={selectedDate ?? undefined}
              onSelect={(nextDate) => {
                if (!nextDate) {
                  return;
                }
                const nextDatePart = toDatePart(nextDate);
                setDatePart(nextDatePart);
                if (mode === "date") {
                  onChange(nextDatePart);
                  return;
                }
                onChange(toDateTimeLocalValue(nextDatePart, timePart));
              }}
            />

            {mode === "datetime" ? (
              <label className="grid gap-1 text-xs text-violet-300">
                Час
                <div className="relative">
                  <input
                    type="time"
                    step="60"
                    value={timePart}
                    onChange={(event) => {
                      const nextTimePart = event.target.value;
                      setTimePart(nextTimePart);
                      onChange(toDateTimeLocalValue(datePart, nextTimePart));
                    }}
                    className="h-10 w-full rounded-lg border border-violet-700/70 bg-violet-950/40 px-3 pr-10 text-sm text-violet-100 outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  />
                  <Clock3 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300" />
                </div>
              </label>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

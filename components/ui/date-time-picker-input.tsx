"use client";

import { CalendarDays, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  CalendarWithTime,
  DateTimeLocalTimeControls,
} from "@/components/ui/calendar-with-time";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  mode?: "date" | "datetime";
  /** Block past calendar days only; time is free to choose on any allowed day. */
  disablePastDays?: boolean;
  /** Light styling for public / light backgrounds; default matches dark dashboard. */
  variant?: "default" | "light";
  /**
   * Where the calendar panel opens: below the field (filters / page) or above (modals at bottom).
   * @default "below"
   */
  calendarPlacement?: "below" | "above";
  /**
   * When set, time is limited to these slot starts (e.g. public booking API).
   * undefined — free time input; null — loading slots.
   */
  slotStartsIso?: string[] | null;
  /** Calendar popover shows only the date; time is below the trigger (public /u/… booking). */
  hideTimeInCalendar?: boolean;
};

function splitDateTime(value: string): { datePart: string; timePart: string } {
  if (!value) {
    return { datePart: "", timePart: "" };
  }
  const [datePart, timePartRaw] = value.split("T");
  const raw = (timePartRaw ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(raw);
  const timePart = m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
  return { datePart: datePart ?? "", timePart };
}

function toDateTimeLocalValue(datePart: string, timePart: string): string {
  if (!datePart || !timePart) {
    return "";
  }
  return `${datePart}T${timePart}`;
}

const triggerVariants = {
  default:
    "flex h-10 w-full items-center justify-between rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-left text-sm text-violet-100 outline-none transition hover:bg-violet-900/60 focus-visible:ring-2 focus-visible:ring-violet-500",
  light:
    "flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400",
} as const;

export function DateTimePickerInput({
  id,
  value,
  onChange,
  placeholder = "Обери дату та час",
  className,
  mode = "datetime",
  disablePastDays = false,
  variant = "default",
  calendarPlacement = "below",
  slotStartsIso,
  hideTimeInCalendar = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [datePart, setDatePart] = useState("");
  const [timePart, setTimePart] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeFieldId = useId();
  const timeControlId = id ? `${id}-time` : timeFieldId;

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

  const closeOnPickDate =
    mode === "date" || (mode === "datetime" && hideTimeInCalendar);

  return (
    <div ref={containerRef} className={cn("relative space-y-2", className)}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={triggerVariants[variant]}
      >
        <span
          className={cn(
            !displayValue &&
              (variant === "light" ? "text-slate-400" : "text-violet-400"),
          )}
        >
          {displayValue || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            aria-label="Очистити дату"
            onClick={(event) => {
              event.stopPropagation();
              setDatePart("");
              setTimePart("");
              onChange("");
              setOpen(false);
            }}
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-sm transition",
              variant === "light"
                ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                : "text-violet-300 hover:bg-violet-800/60 hover:text-violet-50",
            )}
          >
            <X className="h-4 w-4 shrink-0" />
          </span>
        ) : (
          <CalendarDays
            className={cn(
              "h-4 w-4 shrink-0",
              variant === "light" ? "text-slate-500" : "text-violet-300",
            )}
          />
        )}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute left-0 z-30",
            calendarPlacement === "above"
              ? "bottom-[calc(100%+0.5rem)]"
              : "top-[calc(100%+0.5rem)]",
          )}
        >
          <div className="grid gap-3">
            <CalendarWithTime
              value={mode === "date" ? datePart : toDateTimeLocalValue(datePart, timePart)}
              mode={mode}
              disablePastDays={disablePastDays}
              slotStartsIso={
                mode === "datetime" && !hideTimeInCalendar
                  ? slotStartsIso
                  : undefined
              }
              hideTime={hideTimeInCalendar}
              onDateSelect={closeOnPickDate ? () => setOpen(false) : undefined}
              onChange={(nextValue) => {
                const parts = splitDateTime(nextValue);
                setDatePart(parts.datePart);
                setTimePart(parts.timePart);
                onChange(nextValue);
              }}
            />
          </div>
        </div>
      ) : null}

      {hideTimeInCalendar && mode === "datetime" && datePart ? (
        <Field>
          <FieldLabel htmlFor={timeControlId}>Час</FieldLabel>
          <DateTimeLocalTimeControls
            id={timeControlId}
            value={toDateTimeLocalValue(datePart, timePart || "00:00")}
            onChange={(nextValue) => {
              const parts = splitDateTime(nextValue);
              setDatePart(parts.datePart);
              setTimePart(parts.timePart);
              onChange(nextValue);
            }}
            slotStartsIso={slotStartsIso}
          />
        </Field>
      ) : null}
    </div>
  );
}

"use client"

import * as React from "react"
import { isBefore, isSameDay, startOfDay } from "date-fns"
import { uk } from "date-fns/locale"
import { Clock2Icon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { isoToLocalDatetimeInputValue } from "@/lib/datetime-local"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (nextValue: string) => void
  onDateSelect?: () => void
  mode?: "date" | "datetime"
  /** When true, calendar days before today are disabled (time is not restricted). */
  disablePastDays?: boolean
  /**
   * Restrict time to server-provided slot starts (public booking).
   * undefined — free <input type="time">; null — loading; [] — no slots.
   */
  slotStartsIso?: string[] | null
  /** When true, time controls are not rendered in the card (use under the trigger, e.g. public booking). */
  hideTime?: boolean
}

const slotSelectClassName = cn(
  "flex h-10 w-full rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-sm text-violet-100 outline-none transition",
  "focus-visible:ring-2 focus-visible:ring-violet-500",
)

function toDatePart(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseDate(value: string): Date | undefined {
  if (!value) {
    return undefined
  }
  const [datePart] = value.split("T")
  if (!datePart) {
    return undefined
  }
  const [yearRaw, monthRaw, dayRaw] = datePart.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined
  }
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** HH:MM for <input type="time"> with minute step (avoids HH:MM:SS vs HH:MM controlled mismatch). */
function parseTime(value: string): string {
  if (!value) {
    return ""
  }
  const [, timeRaw] = value.split("T")
  if (!timeRaw) {
    return ""
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(timeRaw.trim())
  if (!m) {
    return ""
  }
  return `${m[1].padStart(2, "0")}:${m[2]}`
}

function normalizeTimeHHMM(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim())
  if (!m) {
    return raw.slice(0, 5)
  }
  return `${m[1].padStart(2, "0")}:${m[2]}`
}

export type DateTimeLocalTimeControlsProps = {
  id: string
  value: string
  onChange: (nextValue: string) => void
  /**
   * undefined — free time input; null — loading; [] — no slots.
   */
  slotStartsIso?: string[] | null
  className?: string
}

/** Time row for datetime-local value: free time or slot list (shared by calendar footer and inline layout). */
export function DateTimeLocalTimeControls({
  id,
  value,
  onChange,
  slotStartsIso,
  className,
}: DateTimeLocalTimeControlsProps) {
  const [startTime, setStartTime] = React.useState(parseTime(value))

  const slotOptions = React.useMemo(() => {
    if (!slotStartsIso?.length) {
      return [] as { iso: string; local: string; label: string }[]
    }
    return slotStartsIso.map((iso) => {
      const local = isoToLocalDatetimeInputValue(iso)
      const d = new Date(iso)
      const label = Number.isNaN(d.getTime())
        ? local
        : d.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
      return { iso, local, label }
    })
  }, [slotStartsIso])

  React.useEffect(() => {
    setStartTime(parseTime(value))
  }, [value])

  const date = parseDate(value)

  return (
    <div className={className}>
      {slotStartsIso === undefined ? (
        <InputGroup>
          <InputGroupInput
            id={id}
            type="time"
            step={60}
            value={startTime}
            onChange={(event) => {
              const nextTime = normalizeTimeHHMM(event.target.value)
              setStartTime(nextTime)
              if (!date) {
                return
              }
              onChange(`${toDatePart(date)}T${nextTime}`)
            }}
            className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
          <InputGroupAddon>
            <Clock2Icon className="text-muted-foreground" />
          </InputGroupAddon>
        </InputGroup>
      ) : slotStartsIso === null ? (
        <p
          id={id}
          className="rounded-lg border border-violet-700/50 bg-violet-950/40 px-3 py-2 text-sm text-violet-300"
        >
          Завантаження слотів…
        </p>
      ) : slotStartsIso.length === 0 ? (
        <p
          id={id}
          className="rounded-lg border border-violet-700/50 bg-violet-950/40 px-3 py-2 text-sm text-violet-300"
        >
          Немає вільних слотів у цей день.
        </p>
      ) : (
        <select
          id={id}
          className={slotSelectClassName}
          value={
            slotOptions.some((o) => o.local === value)
              ? value
              : slotOptions[0]?.local ?? ""
          }
          onChange={(event) => {
            const next = event.target.value
            setStartTime(parseTime(next))
            onChange(next)
          }}
        >
          {slotOptions.map((o) => (
            <option key={o.iso} value={o.local}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function CalendarWithTime({
  value,
  onChange,
  onDateSelect,
  mode = "datetime",
  disablePastDays = false,
  slotStartsIso,
  hideTime = false,
}: Props) {
  const [date, setDate] = React.useState<Date | undefined>(parseDate(value))
  const [startTime, setStartTime] = React.useState(parseTime(value))
  const startTimeId = React.useId()

  React.useEffect(() => {
    setDate(parseDate(value))
    setStartTime(parseTime(value))
  }, [value])

  return (
    <Card size="sm" className="mx-auto w-fit border-violet-700/70 bg-[#2a1050]">
      <CardContent className="rounded-xl bg-gradient-to-b from-[#2c0f56] to-[#1b0a36] p-2">
        <Calendar
          locale={uk}
          mode="single"
          selected={date}
          disabled={
            disablePastDays
              ? (day) => {
                  const today = startOfDay(new Date())
                  const d = startOfDay(day)
                  if (!isBefore(d, today)) {
                    return false
                  }
                  // Keep current value selectable when editing a record already in the past
                  if (date && isSameDay(d, startOfDay(date))) {
                    return false
                  }
                  return true
                }
              : undefined
          }
          onSelect={(nextDate) => {
            setDate(nextDate)
            if (!nextDate) {
              onChange("")
              return
            }
            const datePart = toDatePart(nextDate)
            if (mode === "date") {
              onChange(datePart)
              onDateSelect?.()
              return
            }
            const nextTime = startTime || "00:00"
            onChange(`${datePart}T${nextTime}`)
            onDateSelect?.()
          }}
          className="[--cell-size:2.4rem] bg-transparent p-0"
          classNames={{
            root: "bg-transparent",
            month: "bg-transparent",
            months: "bg-transparent",
            nav: "absolute inset-x-0 top-[25px] flex h-12 w-full items-center justify-between px-9",
            month_caption: "flex h-12 w-full items-center justify-center px-12",
            caption_label: "text-violet-100 font-semibold leading-none tracking-wide",
            button_previous: "self-center",
            button_next: "self-center",
            weekday:
              "flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-violet-300 select-none",
            day: "group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none text-violet-100 hover:bg-violet-800/60",
            // react-day-picker v9: DayFlag / SelectionState keys (not day_today / day_selected)
            today:
              "rounded-(--cell-radius) !bg-violet-800 !text-white [&_button]:!text-white",
            selected: "rounded-(--cell-radius)",
            outside: "text-violet-400/70 aria-selected:text-violet-400/70",
          }}
        />
      </CardContent>
      {mode === "datetime" && !hideTime ? (
        <CardFooter className="border-t border-violet-700/70 bg-[#2a1050]">
          <Field>
            <FieldLabel htmlFor={startTimeId}>Час</FieldLabel>
            <DateTimeLocalTimeControls
              id={startTimeId}
              value={value}
              onChange={onChange}
              slotStartsIso={slotStartsIso}
            />
          </Field>
        </CardFooter>
      ) : null}
    </Card>
  )
}

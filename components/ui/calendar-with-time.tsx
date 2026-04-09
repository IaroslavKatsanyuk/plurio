"use client"

import * as React from "react"
import { isBefore, isSameDay, startOfDay } from "date-fns"
import { Clock2Icon } from "lucide-react"

import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

type Props = {
  value: string
  onChange: (nextValue: string) => void
  onDateSelect?: () => void
  mode?: "date" | "datetime"
  /** When true, calendar days before today are disabled (time is not restricted). */
  disablePastDays?: boolean
}

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

export function CalendarWithTime({
  value,
  onChange,
  onDateSelect,
  mode = "datetime",
  disablePastDays = false,
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
            day_selected:
              "bg-violet-500 text-white hover:bg-violet-500 rounded-(--cell-radius)",
            day_today: "rounded-(--cell-radius) bg-violet-800 text-violet-100",
            outside: "text-violet-400/70 aria-selected:text-violet-400/70",
          }}
        />
      </CardContent>
      {mode === "datetime" ? (
        <CardFooter className="border-t border-violet-700/70 bg-[#2a1050]">
          <Field>
            <FieldLabel htmlFor={startTimeId}>Час</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id={startTimeId}
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
          </Field>
        </CardFooter>
      ) : null}
    </Card>
  )
}

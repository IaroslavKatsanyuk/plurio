"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-medium text-violet-100 capitalize",
        nav: "flex items-center gap-1",
        nav_button:
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-violet-300 hover:bg-violet-800/60 hover:text-violet-100",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "grid grid-cols-7",
        head_cell: "h-8 text-center text-xs font-medium text-violet-300",
        row: "mt-1 grid grid-cols-7",
        cell: "p-0 text-center",
        day: "h-8 w-8 rounded-md text-sm text-violet-100 transition hover:bg-violet-800/60",
        day_selected:
          "bg-violet-500 text-white hover:bg-violet-500 focus:bg-violet-500",
        day_today: "border border-violet-400",
        day_outside: "text-violet-500 opacity-70",
        day_disabled: "text-violet-600 opacity-50",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...iconProps} />
          ) : (
            <ChevronRight className="h-4 w-4" {...iconProps} />
          ),
      }}
      {...props}
    />
  );
}

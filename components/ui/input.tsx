import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "relative flex h-10 w-full rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-sm text-violet-100 outline-none transition placeholder:text-violet-400 focus-visible:ring-2 focus-visible:ring-violet-500 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90 [&[type='date']]:pr-10 [&[type='datetime-local']]:pr-10 [&[type='date']::-webkit-calendar-picker-indicator]:absolute [&[type='datetime-local']::-webkit-calendar-picker-indicator]:absolute [&[type='date']::-webkit-calendar-picker-indicator]:right-3 [&[type='datetime-local']::-webkit-calendar-picker-indicator]:right-3",
        // WebKit/Chrome autofill uses :-webkit-autofill; override to match dark fields.
        "[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(237_233_254)]",
        // Solid fill closer to bg-violet-950/50 + border-violet-700/70 fields (not light grey).
        "[&:-webkit-autofill]:[box-shadow:0_0_0_1000px_rgb(39_19_72_/_0.94)_inset]",
        "[&:-webkit-autofill]:[transition:background-color_99999s_ease-out_0s]",
        "[&:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_rgb(39_19_72_/_0.94)_inset]",
        "[&:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_rgb(39_19_72_/_0.94)_inset]",
        className,
      )}
      {...props}
    />
  );
}

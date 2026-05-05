import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "relative flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-90 [&[type='date']]:pr-10 [&[type='datetime-local']]:pr-10 [&[type='date']::-webkit-calendar-picker-indicator]:absolute [&[type='datetime-local']::-webkit-calendar-picker-indicator]:absolute [&[type='date']::-webkit-calendar-picker-indicator]:right-3 [&[type='datetime-local']::-webkit-calendar-picker-indicator]:right-3",
        "[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(15_23_42)]",
        "[&:-webkit-autofill]:[box-shadow:0_0_0_1000px_rgb(255_255_255)_inset]",
        "[&:-webkit-autofill]:[transition:background-color_99999s_ease-out_0s]",
        "[&:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_rgb(255_255_255)_inset]",
        "[&:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_rgb(255_255_255)_inset]",
        className,
      )}
      {...props}
    />
  );
}

import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-violet-700/70 bg-violet-950/50 px-3 py-2 text-sm text-violet-100 outline-none transition placeholder:text-violet-400 focus-visible:ring-2 focus-visible:ring-violet-500",
        className,
      )}
      {...props}
    />
  );
}

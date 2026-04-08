import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-violet-200 bg-white p-8 shadow-sm dark:border-violet-800 dark:bg-violet-950",
        className,
      )}
      {...props}
    />
  );
}

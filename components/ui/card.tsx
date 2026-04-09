import * as React from "react";

import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: "default" | "sm";
};

export function Card({
  className,
  size = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-violet-200 bg-white shadow-sm dark:border-violet-800 dark:bg-violet-950",
        size === "sm" ? "p-4" : "p-8",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-3 pt-3", className)} {...props} />;
}

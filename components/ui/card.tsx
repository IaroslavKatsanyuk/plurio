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
        "w-full max-w-none rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        size === "sm" ? "p-4" : "p-6",
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

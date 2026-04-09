import * as React from "react";

import { cn } from "@/lib/utils";

export function InputGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center rounded-lg border border-violet-700/70 bg-violet-950/40",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-full w-full bg-transparent px-3 text-sm text-violet-100 outline-none",
        "[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(237_233_254)]",
        "[&:-webkit-autofill]:[box-shadow:0_0_0_1000px_rgb(39_19_72_/_0.9)_inset]",
        "[&:-webkit-autofill]:[transition:background-color_99999s_ease-out_0s]",
        "[&:-webkit-autofill:hover]:[box-shadow:0_0_0_1000px_rgb(39_19_72_/_0.9)_inset]",
        "[&:-webkit-autofill:focus]:[box-shadow:0_0_0_1000px_rgb(39_19_72_/_0.9)_inset]",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-full items-center border-l border-violet-700/70 px-3 text-violet-300",
        className,
      )}
      {...props}
    />
  );
}

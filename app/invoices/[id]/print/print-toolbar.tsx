"use client";

import Link from "next/link";
import { Printer } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function InvoicePrintToolbar() {
  return (
    <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <Button type="button" className="gap-2" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden />
        Друк або зберегти як PDF
      </Button>
      <Link href="/invoices" className={cn(buttonVariants({ variant: "outline" }))}>
        До списку інвойсів
      </Link>
    </div>
  );
}

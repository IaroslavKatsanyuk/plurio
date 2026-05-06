import type { InvoiceLineItem } from "@/services/types";

export function computeInvoiceTotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
}

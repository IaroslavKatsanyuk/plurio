import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { notFound, redirect } from "next/navigation";

import { InvoicePrintToolbar } from "@/app/invoices/[id]/print/print-toolbar";
import { createClient } from "@/lib/supabase/server";
import { getInvoiceById } from "@/services/invoice.service";
import { getProfile } from "@/services/profile.service";

type Props = { params: Promise<{ id: string }> };

const statusLabels = {
  draft: "Чернетка",
  issued: "Виставлено",
  paid: "Оплачено",
  void: "Анульовано",
} as const;

export default async function InvoicePrintPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invoices/${id}/print`)}`);
  }

  const [invoiceResult, profileResult] = await Promise.all([getInvoiceById(id), getProfile()]);
  if (!invoiceResult.ok) {
    if (
      invoiceResult.error.code === "UNAUTHORIZED" ||
      invoiceResult.error.code === "AUTH_ERROR"
    ) {
      redirect(`/login?next=${encodeURIComponent(`/invoices/${id}/print`)}`);
    }
    notFound();
  }
  const invoice = invoiceResult.data;
  const sellerName =
    profileResult.ok && profileResult.data?.display_name?.trim()
      ? profileResult.data.display_name.trim()
      : user.email ?? "Plurio";

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground print:bg-white print:p-8">
      <div className="mx-auto max-w-3xl">
        <InvoicePrintToolbar />

        <header className="mb-8 flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-2xl font-bold">Рахунок № {invoice.number}</p>
            <p className="text-sm text-muted-foreground">
              {statusLabels[invoice.status]} · виставлено{" "}
              {format(new Date(invoice.issued_at), "d MMMM yyyy, HH:mm", { locale: uk })}
            </p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-semibold">{sellerName}</p>
          </div>
        </header>

        <section className="mb-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Платник
          </h2>
          <p className="text-lg font-medium">{invoice.client_name}</p>
          {invoice.client_email ? <p className="text-sm">{invoice.client_email}</p> : null}
          {invoice.client_phone ? <p className="text-sm">{invoice.client_phone}</p> : null}
          {invoice.due_at ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Сплата до: {format(new Date(invoice.due_at), "d MMMM yyyy", { locale: uk })}
            </p>
          ) : null}
        </section>

        <table className="mb-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 pr-2 font-medium">Опис</th>
              <th className="w-20 py-2 text-right font-medium">К-ть</th>
              <th className="w-28 py-2 text-right font-medium">Ціна, ₴</th>
              <th className="w-32 py-2 text-right font-medium">Сума, ₴</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((line, idx) => {
              const lineTotal = line.quantity * line.unit_price;
              return (
                <tr key={idx} className="border-b border-border/80">
                  <td className="py-2.5 pr-2 align-top">{line.description}</td>
                  <td className="py-2.5 text-right tabular-nums">{line.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {line.unit_price.toLocaleString("uk-UA", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums">
                    {lineTotal.toLocaleString("uk-UA", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-end border-t border-border pt-4">
          <p className="text-lg font-bold">
            До сплати: {invoice.total.toLocaleString("uk-UA", { minimumFractionDigits: 2 })} ₴
          </p>
        </div>

        {invoice.notes?.trim() ? (
          <section className="mt-8 text-sm text-muted-foreground">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-foreground">Примітки</h2>
            <p className="whitespace-pre-wrap">{invoice.notes.trim()}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

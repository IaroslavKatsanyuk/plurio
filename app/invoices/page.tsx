import { InvoicesCrud } from "@/app/invoices/invoices-crud";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { getInvoices } from "@/services/invoice.service";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const invoicesResult = await getInvoices();
  const initialInvoices = invoicesResult.ok ? invoicesResult.data : [];
  const initialError = invoicesResult.ok ? null : invoicesResult.error.message;

  return (
    <DashboardShell active="invoices" userEmail={user.email ?? ""} title="Інвойси">
      <InvoicesCrud initialInvoices={initialInvoices} initialError={initialError} />
    </DashboardShell>
  );
}

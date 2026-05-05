import { TaxesCalculator } from "@/components/dashboard/taxes-calculator";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/server";

export default async function TaxesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // У схемі записів немає суми доходу — підказка 0; введіть дохід вручну після узгодження з бухгалтерією.
  const suggestedIncomeYear = 0;

  return (
    <DashboardShell active="taxes" userEmail={user.email ?? ""} title="Податки" subtitle="Орієнтовний розрахунок">
      <TaxesCalculator suggestedIncomeYear={suggestedIncomeYear} />
    </DashboardShell>
  );
}

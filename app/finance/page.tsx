import { FinancePageContent } from "./finance-page-content";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PlaceholderSection } from "@/components/dashboard/placeholder-section";
import { createClient } from "@/lib/supabase/server";
import type { FinanceBundle } from "@/services/analytics.service";
import { getAnalyticsBundle } from "@/services/analytics.service";
import { getExpenses } from "@/services/expense.service";

export default async function FinancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [bundleResult, expensesResult] = await Promise.all([
    getAnalyticsBundle(),
    getExpenses(),
  ]);

  if (!bundleResult.ok) {
    return (
      <DashboardShell
        active="finance"
        userEmail={user.email ?? ""}
        title="Фінанси"
        subtitle="Доходи, витрати та прибуток"
      >
        <PlaceholderSection title="Помилка" description={bundleResult.error.message} />
      </DashboardShell>
    );
  }

  if (!expensesResult.ok) {
    return (
      <DashboardShell
        active="finance"
        userEmail={user.email ?? ""}
        title="Фінанси"
        subtitle="Доходи, витрати та прибуток"
      >
        <PlaceholderSection title="Помилка" description={expensesResult.error.message} />
      </DashboardShell>
    );
  }

  const financeBundle: FinanceBundle = {
    ...bundleResult.data,
    expenses: expensesResult.data,
  };

  return <FinancePageContent userEmail={user.email ?? ""} bundle={financeBundle} />;
}

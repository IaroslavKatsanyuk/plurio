import { AnalyticsPageContent } from "./analytics-page-content";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PlaceholderSection } from "@/components/dashboard/placeholder-section";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsBundle } from "@/services/analytics.service";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const bundleResult = await getAnalyticsBundle();
  if (!bundleResult.ok) {
    return (
      <DashboardShell
        active="analytics"
        userEmail={user.email ?? ""}
        title="Аналітика"
        subtitle="Статистика та звіти бізнесу"
      >
        <PlaceholderSection title="Помилка" description={bundleResult.error.message} />
      </DashboardShell>
    );
  }

  return <AnalyticsPageContent userEmail={user.email ?? ""} bundle={bundleResult.data} />;
}

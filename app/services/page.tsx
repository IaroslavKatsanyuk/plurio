import { DashboardNavbar } from "@/components/dashboard/navbar";
import { createClient } from "@/lib/supabase/server";
import { getServices } from "@/services/service.service";

import { ServicesCrudTable } from "@/app/dashboard/services/services-crud-table";

export default async function ServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const servicesResult = await getServices();
  const initialServices = servicesResult.ok ? servicesResult.data : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#120726] via-[#0f061f] to-[#080312]">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 lg:flex-row">
        <div className="w-full lg:w-72">
          <DashboardNavbar active="services" userEmail={user.email ?? ""} />
        </div>
        <main className="min-w-0 flex-1">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-violet-50">Послуги</h1>
            <p className="text-sm text-violet-300">{user.email}</p>
          </header>
          <ServicesCrudTable initialServices={initialServices} />
        </main>
      </div>
    </div>
  );
}

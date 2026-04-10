import { DashboardNavbar } from "@/components/dashboard/navbar";
import { createClient } from "@/lib/supabase/server";
import { getClients } from "@/services/client.service";

import { ClientsCrudTable } from "@/app/dashboard/clients/clients-crud-table";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const clientsResult = await getClients();
  const initialClients = clientsResult.ok ? clientsResult.data : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#120726] via-[#0f061f] to-[#080312]">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <DashboardNavbar active="clients" userEmail={user.email ?? ""} />
      <main className="min-w-0 flex-1">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-violet-50">
            Клієнти
          </h1>
          <p className="text-sm text-violet-300">{user.email}</p>
        </header>
        <ClientsCrudTable initialClients={initialClients} />
      </main>
    </div>
    </div>
  );
}

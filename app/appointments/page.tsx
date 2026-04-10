import { DashboardNavbar } from "@/components/dashboard/navbar";
import { createClient } from "@/lib/supabase/server";
import { getAppointments } from "@/services/appointment.service";
import { getClients } from "@/services/client.service";
import { getServices } from "@/services/service.service";

import { AppointmentsCrud } from "@/app/dashboard/appointments/appointments-crud";

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const appointmentsResult = await getAppointments();
  const clientsResult = await getClients();
  const servicesResult = await getServices();
  const initialAppointments = appointmentsResult.ok ? appointmentsResult.data : [];
  const initialClients = clientsResult.ok ? clientsResult.data : [];
  const initialServices = servicesResult.ok ? servicesResult.data : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#120726] via-[#0f061f] to-[#080312]">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <DashboardNavbar active="appointments" userEmail={user.email ?? ""} />
      <main className="min-w-0 flex-1">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-violet-50">
            Записи
          </h1>
          <p className="text-sm text-violet-300">{user.email}</p>
        </header>
        <AppointmentsCrud
          initialAppointments={initialAppointments}
          clients={initialClients}
          services={initialServices}
        />
      </main>
    </div>
    </div>
  );
}

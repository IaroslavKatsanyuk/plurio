import { createClient } from "@/lib/supabase/server";
import { getAppointments } from "@/services/appointment.service";
import { getClients } from "@/services/client.service";
import { getServices } from "@/services/service.service";

import { AppointmentsPageContent } from "@/app/appointments/appointments-page-content";

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
    <AppointmentsPageContent
      userEmail={user.email ?? ""}
      initialAppointments={initialAppointments}
      clients={initialClients}
      services={initialServices}
    />
  );
}

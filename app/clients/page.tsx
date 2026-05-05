import { createClient } from "@/lib/supabase/server";
import { getClients } from "@/services/client.service";

import { ClientsPageContent } from "@/app/clients/clients-page-content";

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

  return <ClientsPageContent userEmail={user.email ?? ""} initialClients={initialClients} />;
}

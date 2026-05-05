import { createClient } from "@/lib/supabase/server";
import { getServices } from "@/services/service.service";

import { ServicesPageContent } from "@/app/services/services-page-content";

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

  return <ServicesPageContent userEmail={user.email ?? ""} initialServices={initialServices} />;
}

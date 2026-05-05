import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { getOrders } from "@/services/order.service";

import { OrdersCrud } from "@/app/orders/orders-crud";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const ordersResult = await getOrders();
  const initialOrders = ordersResult.ok ? ordersResult.data : [];
  const initialError = ordersResult.ok ? null : ordersResult.error.message;

  return (
    <DashboardShell active="orders" userEmail={user.email ?? ""} title="Замовлення">
      <OrdersCrud initialOrders={initialOrders} initialError={initialError} />
    </DashboardShell>
  );
}

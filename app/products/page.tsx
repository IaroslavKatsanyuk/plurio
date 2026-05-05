import { createClient } from "@/lib/supabase/server";
import { getProducts } from "@/services/product.service";

import { ProductsPageContent } from "@/app/products/products-page-content";

export default async function ProductsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const productsResult = await getProducts();
  const initialProducts = productsResult.ok ? productsResult.data : [];

  return <ProductsPageContent userEmail={user.email ?? ""} initialProducts={initialProducts} />;
}

"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";

import { ProductsCrudTable, type ProductsCrudTableRef } from "@/app/dashboard/products/products-crud-table";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import type { ProductRow } from "@/services/types";

type Props = {
  userEmail: string;
  initialProducts: ProductRow[];
};

export function ProductsPageContent({ userEmail, initialProducts }: Props) {
  const crudRef = useRef<ProductsCrudTableRef>(null);
  const [count, setCount] = useState(initialProducts.length);

  return (
    <DashboardShell
      active="products"
      userEmail={userEmail}
      title="Товари"
      subtitle={`${count} позицій`}
      headerRight={
        <Button
          type="button"
          className="gap-2 shadow-md shadow-primary/20"
          onClick={() => crudRef.current?.openCreateModal()}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Новий товар
        </Button>
      }
    >
      <ProductsCrudTable ref={crudRef} initialProducts={initialProducts} onCountChange={setCount} />
    </DashboardShell>
  );
}

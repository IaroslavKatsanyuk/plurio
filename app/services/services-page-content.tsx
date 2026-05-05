"use client";

import { useRef, useState } from "react";

import { ServicesCrudTable, type ServicesCrudTableRef } from "@/app/dashboard/services/services-crud-table";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import type { ServiceRow } from "@/services/types";
import { Plus } from "lucide-react";

type Props = {
  userEmail: string;
  initialServices: ServiceRow[];
};

export function ServicesPageContent({ userEmail, initialServices }: Props) {
  const crudRef = useRef<ServicesCrudTableRef>(null);
  const [count, setCount] = useState(initialServices.length);

  return (
    <DashboardShell
      active="services"
      userEmail={userEmail}
      title="Послуги"
      subtitle={`${count} послуг`}
      headerRight={
        <Button
          type="button"
          className="gap-2 shadow-md shadow-primary/20"
          onClick={() => crudRef.current?.openCreateModal()}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Нова послуга
        </Button>
      }
    >
      <ServicesCrudTable
        ref={crudRef}
        initialServices={initialServices}
        onCountChange={setCount}
      />
    </DashboardShell>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";

import { ClientsCrudTable, type ClientsCrudTableRef } from "@/app/dashboard/clients/clients-crud-table";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ExportButton } from "@/components/dashboard/export-button";
import { Button } from "@/components/ui/button";
import type { ClientRow } from "@/services/types";

import { clientExportColumns } from "@/app/dashboard/clients/clients-export-columns";

type Props = {
  userEmail: string;
  initialClients: ClientRow[];
};

export function ClientsPageContent({ userEmail, initialClients }: Props) {
  const crudRef = useRef<ClientsCrudTableRef>(null);
  const [exportRows, setExportRows] = useState<ClientRow[]>(initialClients);

  const handleFilteredChange = useCallback((rows: ClientRow[]) => {
    setExportRows(rows);
  }, []);

  return (
    <DashboardShell
      active="clients"
      userEmail={userEmail}
      title="Клієнти"
      subtitle={userEmail}
      headerRight={
        <>
          <ExportButton data={exportRows} columns={clientExportColumns} filename="clients" />
          <Button type="button" onClick={() => crudRef.current?.openCreateModal()}>
            Створити клієнта
          </Button>
        </>
      }
    >
      <ClientsCrudTable
        ref={crudRef}
        initialClients={initialClients}
        onFilteredRowsChange={handleFilteredChange}
      />
    </DashboardShell>
  );
}

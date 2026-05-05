"use client";

import { useRef } from "react";

import { AppointmentsCrud, type AppointmentsCrudRef } from "@/app/dashboard/appointments/appointments-crud";
import { InboxClearOnVisit } from "@/components/dashboard/inbox-clear-on-visit";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import type { AppointmentRow, ClientRow, ServiceRow } from "@/services/types";

type Props = {
  userEmail: string;
  initialAppointments: AppointmentRow[];
  clients: ClientRow[];
  services: ServiceRow[];
};

export function AppointmentsPageContent({
  userEmail,
  initialAppointments,
  clients,
  services,
}: Props) {
  const crudRef = useRef<AppointmentsCrudRef>(null);

  return (
    <DashboardShell
      active="appointments"
      userEmail={userEmail}
      title="Записи"
      subtitle={userEmail}
      topSlot={<InboxClearOnVisit />}
      headerRight={
        <Button type="button" onClick={() => crudRef.current?.openCreateModal()}>
          Створити запис
        </Button>
      }
    >
      <AppointmentsCrud
        ref={crudRef}
        initialAppointments={initialAppointments}
        clients={clients}
        services={services}
      />
    </DashboardShell>
  );
}

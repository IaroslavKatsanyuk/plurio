import {
  deleteAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/services/appointment.service";
import type { AppointmentStatus } from "@/services/types";

export const dynamic = "force-dynamic";

const allowedStatuses: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    mode?: "status" | "full";
    status?: AppointmentStatus;
    client_id?: string | null;
    service_id?: string | null;
    title?: string | null;
    starts_at?: string;
    ends_at?: string;
    notes?: string | null;
  };

  if ((body.mode ?? "status") === "status") {
    if (!body.status || !allowedStatuses.includes(body.status)) {
      return Response.json(
        { error: { code: "VALIDATION", message: "Потрібен коректний статус запису." } },
        { status: 400 },
      );
    }

    const result = await updateAppointmentStatus(id, body.status);
    if (!result.ok) {
      const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
      return Response.json(
        { error: { code: result.error.code, message: result.error.message } },
        { status },
      );
    }

    return Response.json({ data: result.data });
  }

  if (body.status && !allowedStatuses.includes(body.status)) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Потрібен коректний статус запису." } },
      { status: 400 },
    );
  }

  const result = await updateAppointment(id, {
    client_id: body.client_id,
    service_id: body.service_id,
    title: body.title,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    status: body.status,
    notes: body.notes,
  });
  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED"
        ? 401
        : result.error.code === "APPOINTMENT_TIME_OVERLAP"
          ? 409
          : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data });
}

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await deleteAppointment(id);
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data });
}

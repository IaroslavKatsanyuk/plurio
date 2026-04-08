import { createAppointment, getAppointments } from "@/services/appointment.service";
import type { AppointmentStatus } from "@/services/types";

export const dynamic = "force-dynamic";

const allowedStatuses: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "cancelled",
  "completed",
];

export async function GET() {
  const result = await getAppointments();
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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    client_id?: string | null;
    title?: string | null;
    starts_at?: string;
    ends_at?: string;
    notes?: string | null;
    status?: AppointmentStatus;
  };

  if (!body.starts_at || !body.ends_at) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Поля starts_at та ends_at обов'язкові." } },
      { status: 400 },
    );
  }
  if (body.status && !allowedStatuses.includes(body.status)) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Некоректний статус запису." } },
      { status: 400 },
    );
  }

  const result = await createAppointment({
    client_id: body.client_id ?? null,
    title: body.title ?? null,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    status: body.status ?? "scheduled",
    notes: body.notes ?? null,
  });

  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data }, { status: 201 });
}

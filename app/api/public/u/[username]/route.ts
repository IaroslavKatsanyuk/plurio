import {
  createPublicBooking,
  getPublicBookingPageData,
  toPublicBookingPayload,
} from "@/services/public-booking.service";

export const dynamic = "force-dynamic";

function statusForServiceError(code: string): number {
  if (code === "NOT_FOUND") {
    return 404;
  }
  if (
    code === "CONFIG_MISSING" ||
    code === "PUBLIC_BOOKING_CREATE_FAILED" ||
    code === "PUBLIC_BOOKING_LOAD_FAILED"
  ) {
    return 503;
  }
  if (code === "APPOINTMENT_TIME_OVERLAP") {
    return 409;
  }
  if (code === "VALIDATION") {
    return 400;
  }
  return 400;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  const result = await getPublicBookingPageData(username);
  if (!result.ok) {
    const status = statusForServiceError(result.error.code);
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  return Response.json({ data: toPublicBookingPayload(result.data) });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "Некоректне тіло запиту.",
        },
      },
      { status: 400 },
    );
  }

  const clientName =
    typeof body.client_name === "string" ? body.client_name : "";
  const starts_at = typeof body.starts_at === "string" ? body.starts_at : "";

  if (!starts_at) {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "Поле часу початку обов'язкове.",
        },
      },
      { status: 400 },
    );
  }

  const phoneRaw =
    typeof body.phone === "string" ? body.phone : "";
  const telegramRaw =
    typeof body.telegram_username === "string" || body.telegram_username === null
      ? (body.telegram_username as string | null)
      : undefined;

  const result = await createPublicBooking({
    username,
    clientName,
    phone: phoneRaw,
    telegram_username: telegramRaw,
    notes:
      typeof body.notes === "string" || body.notes === null
        ? (body.notes as string | null)
        : undefined,
    service_id:
      typeof body.service_id === "string" || body.service_id === null
        ? (body.service_id as string | null)
        : undefined,
    title:
      typeof body.title === "string" || body.title === null
        ? (body.title as string | null)
        : undefined,
    starts_at,
    ends_at:
      typeof body.ends_at === "string" || body.ends_at === null
        ? (body.ends_at as string | null)
        : undefined,
  });

  if (!result.ok) {
    const status = statusForServiceError(result.error.code);
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json(
    { data: { appointment_id: result.data.appointmentId } },
    { status: 201 },
  );
}

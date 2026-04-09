import { getPublicAvailabilitySlots } from "@/services/public-booking.service";

export const dynamic = "force-dynamic";

function statusForError(code: string): number {
  if (code === "NOT_FOUND") {
    return 404;
  }
  if (code === "CONFIG_MISSING" || code === "PUBLIC_BOOKING_LOAD_FAILED") {
    return 503;
  }
  if (code === "VALIDATION") {
    return 400;
  }
  return 400;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  const url = new URL(request.url);
  const dayStartIso = url.searchParams.get("dayStartIso") ?? "";
  const serviceId = url.searchParams.get("service_id");

  if (!dayStartIso.trim()) {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "Параметр dayStartIso обов'язковий.",
        },
      },
      { status: 400 },
    );
  }

  const dayStart = new Date(dayStartIso);
  const result = await getPublicAvailabilitySlots({
    username,
    dayStart,
    serviceId: serviceId?.trim() || null,
  });

  if (!result.ok) {
    const status = statusForError(result.error.code);
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data });
}

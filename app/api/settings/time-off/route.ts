import { createBookingTimeOff, listBookingTimeOff } from "@/services/booking-time-off.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await listBookingTimeOff();
  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED" || result.error.code === "AUTH_ERROR" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  return Response.json({ data: result.data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { start_date?: string; end_date?: string; note?: string | null };
  const result = await createBookingTimeOff({
    start_date: body.start_date ?? "",
    end_date: body.end_date ?? "",
    note: body.note ?? null,
  });
  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED" || result.error.code === "AUTH_ERROR" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  return Response.json({ data: result.data }, { status: 201 });
}

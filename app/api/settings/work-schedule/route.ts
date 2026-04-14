import {
  WEEKDAY_KEYS,
  weeklyFormToSchedule,
  type WeeklyScheduleFormInput,
} from "@/lib/work-schedule";
import { getProfile, updateBookingWorkSchedule } from "@/services/profile.service";

export const dynamic = "force-dynamic";

function isWeeklyFormBody(v: unknown): v is {
  booking_timezone: string;
  weekly: WeeklyScheduleFormInput;
} {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.booking_timezone !== "string") return false;
  const w = o.weekly;
  if (!w || typeof w !== "object") return false;
  for (const key of WEEKDAY_KEYS) {
    const d = (w as Record<string, unknown>)[key];
    if (!d || typeof d !== "object") return false;
    const day = d as Record<string, unknown>;
    if (typeof day.enabled !== "boolean") return false;
    if (typeof day.start !== "string" || typeof day.end !== "string") return false;
  }
  return true;
}

export async function GET() {
  const result = await getProfile();
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  const profile = result.data;
  return Response.json({
    data: {
      booking_timezone: profile?.booking_timezone ?? null,
      work_weekly_schedule: profile?.work_weekly_schedule ?? null,
    },
  });
}

export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isWeeklyFormBody(body)) {
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "Очікується booking_timezone та weekly (дні тижня з enabled, start, end).",
        },
      },
      { status: 400 },
    );
  }

  const schedule = weeklyFormToSchedule(body.weekly);
  const result = await updateBookingWorkSchedule({
    booking_timezone: body.booking_timezone,
    work_weekly_schedule: schedule,
  });

  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data });
}

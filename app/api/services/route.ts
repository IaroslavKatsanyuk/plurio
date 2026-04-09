import { createService, getServices } from "@/services/service.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getServices();
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  return Response.json({ data: result.data });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    duration_minutes?: number;
  };

  if (!body.name?.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Назва послуги обов'язкова." } },
      { status: 400 },
    );
  }
  if (!Number.isFinite(body.duration_minutes) || (body.duration_minutes ?? 0) <= 0) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Тривалість має бути більше 0 хвилин." } },
      { status: 400 },
    );
  }

  const result = await createService({
    name: body.name,
    duration_minutes: Math.floor(body.duration_minutes),
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

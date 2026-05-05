import { createService, getServices } from "@/services/service.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getServices();
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
  const body = (await request.json()) as {
    name?: string;
    duration_minutes?: number;
    price?: number;
    category?: string | null;
    description?: string | null;
  };

  if (!body.name?.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Назва послуги обов'язкова." } },
      { status: 400 },
    );
  }
  const durationMinutes = body.duration_minutes;
  if (
    typeof durationMinutes !== "number" ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Тривалість має бути більше 0 хвилин." } },
      { status: 400 },
    );
  }

  const rawPrice = body.price;
  const priceNum =
    rawPrice === undefined || rawPrice === null
      ? 0
      : typeof rawPrice === "number"
        ? rawPrice
        : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Некоректна ціна." } },
      { status: 400 },
    );
  }

  const result = await createService({
    name: body.name,
    duration_minutes: Math.floor(durationMinutes),
    price: priceNum,
    category: body.category ?? null,
    description: body.description ?? null,
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

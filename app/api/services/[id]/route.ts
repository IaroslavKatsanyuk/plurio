import { deleteService, updateService } from "@/services/service.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    duration_minutes?: number;
    price?: number;
    category?: string | null;
    description?: string | null;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Назва послуги не може бути порожньою." } },
      { status: 400 },
    );
  }
  if (
    body.duration_minutes !== undefined &&
    (!Number.isFinite(body.duration_minutes) || body.duration_minutes <= 0)
  ) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Тривалість має бути більше 0 хвилин." } },
      { status: 400 },
    );
  }
  if (body.price !== undefined) {
    const p = typeof body.price === "number" ? body.price : Number(body.price);
    if (!Number.isFinite(p) || p < 0) {
      return Response.json(
        { error: { code: "VALIDATION", message: "Некоректна ціна." } },
        { status: 400 },
      );
    }
  }

  const result = await updateService(id, {
    name: body.name,
    duration_minutes:
      body.duration_minutes !== undefined ? Math.floor(body.duration_minutes) : undefined,
    price: body.price !== undefined ? (typeof body.price === "number" ? body.price : Number(body.price)) : undefined,
    category: body.category,
    description: body.description,
  });
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

export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await deleteService(id);
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

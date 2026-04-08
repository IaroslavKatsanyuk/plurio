import { deleteClient, updateClient } from "@/services/client.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    phone?: string | null;
    telegram_username?: string | null;
    email?: string | null;
    notes?: string | null;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Ім'я клієнта не може бути порожнім." } },
      { status: 400 },
    );
  }

  const result = await updateClient(id, body);
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
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
  const result = await deleteClient(id);
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data });
}

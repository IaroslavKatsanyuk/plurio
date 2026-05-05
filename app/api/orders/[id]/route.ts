import { deleteOrder, updateOrder } from "@/services/order.service";
import type { OrderStatus } from "@/services/types";

export const dynamic = "force-dynamic";

const allowedStatuses: OrderStatus[] = ["new", "paid", "cancelled"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: OrderStatus;
    client_name?: string;
    client_phone?: string | null;
    source?: string | null;
    total?: number;
    items?: { product_name: string; quantity: number }[];
  };

  if (body.status !== undefined && !allowedStatuses.includes(body.status)) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Некоректний статус." } },
      { status: 400 },
    );
  }

  const result = await updateOrder(id, {
    status: body.status,
    client_name: body.client_name,
    client_phone: body.client_phone,
    source: body.source,
    total: body.total,
    items: body.items,
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
  const result = await deleteOrder(id);
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

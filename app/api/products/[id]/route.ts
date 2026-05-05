import { deleteProduct, updateProduct } from "@/services/product.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    price?: number;
    stock?: number;
    category?: string | null;
    description?: string | null;
  };

  if (body.name !== undefined && !body.name.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Назва товару не може бути порожньою." } },
      { status: 400 },
    );
  }

  const result = await updateProduct(id, {
    name: body.name,
    price: body.price,
    stock: body.stock,
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
  const result = await deleteProduct(id);
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

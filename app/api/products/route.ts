import { createProduct, getProducts } from "@/services/product.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getProducts();
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
    price?: number;
    stock?: number;
    category?: string | null;
    description?: string | null;
  };

  if (!body.name?.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Назва товару обовʼязкова." } },
      { status: 400 },
    );
  }

  const result = await createProduct({
    name: body.name,
    price: body.price,
    stock: body.stock,
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

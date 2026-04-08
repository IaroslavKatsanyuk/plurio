import { createClient, getClients } from "@/services/client.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getClients();
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
    phone?: string | null;
    telegram_username?: string | null;
    email?: string | null;
    notes?: string | null;
  };

  if (!body.name || !body.name.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Ім'я клієнта обов'язкове." } },
      { status: 400 },
    );
  }

  const result = await createClient({
    name: body.name,
    phone: body.phone ?? null,
    telegram_username: body.telegram_username ?? null,
    email: body.email ?? null,
    notes: body.notes ?? null,
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

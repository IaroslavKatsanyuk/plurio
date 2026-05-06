import { createInvoice, getInvoices } from "@/services/invoice.service";
import type { CreateInvoiceInput, InvoiceStatus } from "@/services/types";

export const dynamic = "force-dynamic";

const allowedStatuses: InvoiceStatus[] = ["draft", "issued", "paid", "void"];

export async function GET() {
  const result = await getInvoices();
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
  const body = (await request.json()) as Partial<CreateInvoiceInput>;

  if (!body.client_name?.trim()) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Імʼя клієнта обовʼязкове." } },
      { status: 400 },
    );
  }
  if (body.status && !allowedStatuses.includes(body.status)) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Некоректний статус." } },
      { status: 400 },
    );
  }

  const result = await createInvoice({
    client_name: body.client_name,
    client_email: body.client_email ?? null,
    client_phone: body.client_phone ?? null,
    status: body.status ?? "draft",
    items: Array.isArray(body.items) ? body.items : [],
    notes: body.notes ?? null,
    issued_at: body.issued_at,
    due_at: body.due_at,
  });

  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED" || result.error.code === "AUTH_ERROR"
        ? 401
        : result.error.code === "INVOICE_NUMBER_CONFLICT"
          ? 409
          : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data }, { status: 201 });
}

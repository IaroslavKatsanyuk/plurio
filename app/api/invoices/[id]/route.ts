import { deleteInvoice, updateInvoice } from "@/services/invoice.service";
import type { InvoiceLineItem, InvoiceStatus } from "@/services/types";

export const dynamic = "force-dynamic";

const allowedStatuses: InvoiceStatus[] = ["draft", "issued", "paid", "void"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    status?: InvoiceStatus;
    client_name?: string;
    client_email?: string | null;
    client_phone?: string | null;
    items?: InvoiceLineItem[];
    notes?: string | null;
    issued_at?: string;
    due_at?: string | null;
  };

  if (body.status !== undefined && !allowedStatuses.includes(body.status)) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Некоректний статус." } },
      { status: 400 },
    );
  }

  const result = await updateInvoice(id, {
    status: body.status,
    client_name: body.client_name,
    client_email: body.client_email,
    client_phone: body.client_phone,
    items: body.items,
    notes: body.notes,
    issued_at: body.issued_at,
    due_at: body.due_at,
  });

  if (!result.ok) {
    if (result.error.code === "INVOICE_NOT_FOUND") {
      return Response.json(
        { error: { code: result.error.code, message: result.error.message } },
        { status: 404 },
      );
    }
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
  const result = await deleteInvoice(id);
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

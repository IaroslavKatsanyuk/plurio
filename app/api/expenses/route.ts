import { createExpense, getExpenses } from "@/services/expense.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getExpenses();
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
    title?: string;
    amount?: number;
    category?: string;
    notes?: string | null;
    occurred_on?: string;
  };

  const result = await createExpense({
    title: body.title ?? "",
    amount: body.amount ?? 0,
    category: body.category,
    notes: body.notes ?? null,
    occurred_on: body.occurred_on ?? "",
  });

  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED" || result.error.code === "AUTH_ERROR"
        ? 401
        : result.error.code === "VALIDATION"
          ? 400
          : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data }, { status: 201 });
}

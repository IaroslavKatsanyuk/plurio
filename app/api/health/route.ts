import { getHealthStatus } from "@/services/health.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getHealthStatus();

  if (result.status === "ok") {
    return Response.json({ data: result });
  }

  return Response.json(
    { error: { code: result.error.code, message: result.error.message } },
    { status: 503 },
  );
}

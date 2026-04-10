import { getTelegramNotifyDiagnostics } from "@/services/telegram-notify-diagnostics.service";

export const dynamic = "force-dynamic";

/**
 * GET ?client_id=uuid (опційно) — чи налаштований прод для миттєвих Telegram після запису.
 * Лише для авторизованого користувача; секрети не повертаються.
 */
export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("client_id");
  const result = await getTelegramNotifyDiagnostics(clientId);

  if (!result.ok) {
    const status =
      result.error.code === "UNAUTHORIZED"
        ? 401
        : result.error.code === "CLIENT_NOT_FOUND"
          ? 404
          : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }

  return Response.json({ data: result.data });
}

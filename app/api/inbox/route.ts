import { getOwnerInboxUnreadCount, markOwnerInboxAllRead } from "@/services/owner-inbox.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getOwnerInboxUnreadCount();
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  return Response.json({ data: { unreadCount: result.data } });
}

export async function POST() {
  const result = await markOwnerInboxAllRead();
  if (!result.ok) {
    const status = result.error.code === "UNAUTHORIZED" ? 401 : 400;
    return Response.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status },
    );
  }
  return Response.json({ data: { ok: true } });
}

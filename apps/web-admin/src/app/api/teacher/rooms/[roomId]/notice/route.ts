import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const MESSAGING = process.env.MESSAGING_SERVICE_URL ?? "http://localhost";

export async function POST(
  request: Request,
  context: RouteContext<"/api/teacher/rooms/[roomId]/notice">
) {
  const jar = await cookies();
  const token = jar.get("unichat_teacher_token")?.value;
  const { roomId } = await context.params;
  const body = await request.json().catch(() => null);
  const content = body?.content?.trim();
  if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

  const upstream = await fetch(`${MESSAGING}/api/v1/messages/${roomId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content, clientMessageId: randomUUID() }),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

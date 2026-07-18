import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const MESSAGING = process.env.MESSAGING_SERVICE_URL ?? "http://localhost";

export async function GET(
  request: Request,
  context: RouteContext<"/api/teacher/rooms/[roomId]/messages">
) {
  const jar = await cookies();
  const token = jar.get("unichat_teacher_token")?.value;
  const { roomId } = await context.params;
  const type = new URL(request.url).searchParams.get("type");

  const params = new URLSearchParams({ limit: "50" });
  if (type) params.set("type", type);

  const upstream = await fetch(`${MESSAGING}/api/v1/messages/${roomId}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

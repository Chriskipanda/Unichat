import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/teacher/rooms/[roomId]/members">
) {
  const jar = await cookies();
  const token = jar.get("unichat_teacher_token")?.value;
  const { roomId } = await context.params;
  const upstream = await fetch(`${AUTH}/api/v1/teacher/rooms/${roomId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_teacher_token")?.value;
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/teacher/assignments/[id]/cr">
) {
  const token = await getToken();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const upstream = await fetch(`${AUTH}/api/v1/teacher/assignments/${id}/cr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/teacher/assignments/[id]/cr">
) {
  const token = await getToken();
  const { id } = await context.params;
  const upstream = await fetch(`${AUTH}/api/v1/teacher/assignments/${id}/cr`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (upstream.status === 204) return NextResponse.json({ success: true });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

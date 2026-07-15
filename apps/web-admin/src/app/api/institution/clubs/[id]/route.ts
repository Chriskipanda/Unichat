import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_institution_token")?.value;
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/institution/clubs/[id]">
) {
  const token = await getToken();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const upstream = await fetch(`${AUTH}/api/v1/institution/clubs/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/institution/clubs/[id]">
) {
  const token = await getToken();
  const { id } = await context.params;
  const upstream = await fetch(`${AUTH}/api/v1/institution/clubs/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

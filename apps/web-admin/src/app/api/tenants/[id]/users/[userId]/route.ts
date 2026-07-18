import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_admin_token")?.value ?? "";
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tenants/[id]/users/[userId]">
) {
  const { id, userId } = await ctx.params;
  const token = await getToken();
  const body = await request.json().catch(() => ({}));

  try {
    const res = await fetch(`${AUTH}/api/v1/admin/tenants/${id}/users/${userId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tenants/[id]/users/[userId]">
) {
  const { id, userId } = await ctx.params;
  const token = await getToken();

  try {
    const res = await fetch(`${AUTH}/api/v1/admin/tenants/${id}/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) return new Response(null, { status: 204 });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }
}

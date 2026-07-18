import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_admin_token")?.value ?? "";
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/tenants/[id]/users">
) {
  const { id } = await ctx.params;
  const token = await getToken();
  const { search } = new URL(request.url);

  try {
    const res = await fetch(`${AUTH}/api/v1/admin/tenants/${id}/users${search}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tenants/[id]/users">
) {
  const { id } = await ctx.params;
  const token = await getToken();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const res = await fetch(`${AUTH}/api/v1/admin/tenants/${id}/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }
}

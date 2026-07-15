import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_admin_token")?.value ?? "";
}

export async function GET() {
  const token = await getToken();
  try {
    const res = await fetch(`${AUTH}/api/v1/admin/tenants`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const token = await getToken();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const res = await fetch(`${AUTH}/api/v1/admin/tenants`, {
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

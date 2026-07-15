import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("unichat_admin_token")?.value ?? "";

  try {
    const res = await fetch(`${AUTH}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }
}

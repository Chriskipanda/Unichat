import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get("unichat_institution_token")?.value;
  const body = await request.json().catch(() => null);
  const upstream = await fetch(`${AUTH}/api/v1/institution/bulk-import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

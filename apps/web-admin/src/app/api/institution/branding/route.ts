import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_institution_token")?.value;
}

export async function GET() {
  const token = await getToken();
  const upstream = await fetch(`${AUTH}/api/v1/institution/branding`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function PATCH(request: Request) {
  const token = await getToken();
  const body = await request.json().catch(() => null);
  const upstream = await fetch(`${AUTH}/api/v1/institution/branding`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

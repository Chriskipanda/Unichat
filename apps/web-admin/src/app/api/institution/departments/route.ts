import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

async function getToken() {
  const jar = await cookies();
  return jar.get("unichat_institution_token")?.value;
}

export async function GET() {
  const token = await getToken();
  const upstream = await fetch(`${AUTH}/api/v1/institution/departments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

// POST body: { type: 'faculty', name } | { type: 'department', facultyId, name }
export async function POST(request: Request) {
  const token = await getToken();
  const body = await request.json().catch(() => null);
  const { type, ...rest } = body ?? {};
  const url =
    type === "department"
      ? `${AUTH}/api/v1/institution/departments`
      : `${AUTH}/api/v1/institution/faculties`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(rest),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

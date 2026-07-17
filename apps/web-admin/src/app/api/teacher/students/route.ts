import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get("unichat_teacher_token")?.value;
  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();
  const upstream = await fetch(`${AUTH}/api/v1/teacher/students${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

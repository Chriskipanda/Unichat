import { NextResponse } from "next/server";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const upstream = await fetch(`${AUTH}/api/v1/auth/teacher/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

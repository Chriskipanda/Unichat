import { NextResponse } from "next/server";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

export async function GET() {
  const upstream = await fetch(`${AUTH}/api/v1/auth/institutions`);
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

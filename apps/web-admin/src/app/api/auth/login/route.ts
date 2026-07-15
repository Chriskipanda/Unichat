import { NextResponse } from "next/server";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  let upstream: Response;
  try {
    upstream = await fetch(`${AUTH}/api/v1/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Auth service unreachable" }, { status: 503 });
  }

  const data = await upstream.json();

  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const response = NextResponse.json({ success: true, user: data.user });
  response.cookies.set("unichat_admin_token", data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return response;
}

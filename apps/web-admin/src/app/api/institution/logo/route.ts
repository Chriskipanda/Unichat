import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const MEDIA = process.env.MEDIA_SERVICE_URL ?? "http://localhost";
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get("unichat_institution_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 512) {
    return NextResponse.json({ error: "Logo must be under 2 MB" }, { status: 413 });
  }

  const formData = await request.formData();
  const upstream = await fetch(`${MEDIA}/api/v1/media/upload/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

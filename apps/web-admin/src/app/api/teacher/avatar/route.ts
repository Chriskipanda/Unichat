import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";
const MEDIA = process.env.MEDIA_SERVICE_URL ?? "http://localhost";
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get("unichat_teacher_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 512) {
    return NextResponse.json({ error: "Photo must be under 2 MB" }, { status: 413 });
  }

  const formData = await request.formData();
  const uploadRes = await fetch(`${MEDIA}/api/v1/media/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    return NextResponse.json(uploadData, { status: uploadRes.status });
  }

  const patchRes = await fetch(`${AUTH}/api/v1/teacher/me`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ avatarUrl: uploadData.url }),
  });
  const patchData = await patchRes.json();
  return NextResponse.json(patchData, { status: patchRes.status });
}

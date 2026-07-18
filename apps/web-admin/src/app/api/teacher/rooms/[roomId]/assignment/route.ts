import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const MESSAGING = process.env.MESSAGING_SERVICE_URL ?? "http://localhost";
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(
  request: Request,
  context: RouteContext<"/api/teacher/rooms/[roomId]/assignment">
) {
  const jar = await cookies();
  const token = jar.get("unichat_teacher_token")?.value;
  const { roomId } = await context.params;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BYTES + 1024) {
    return NextResponse.json({ error: "Attachment must be under 25 MB" }, { status: 413 });
  }

  const formData = await request.formData();
  const title = (formData.get("title") as string | null)?.trim();
  const instructions = (formData.get("instructions") as string | null)?.trim();
  const dueDate = (formData.get("dueDate") as string | null)?.trim();
  const file = formData.get("file") as File | null;

  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const lines = [`📌 Assignment: ${title}`];
  if (instructions) lines.push("", instructions);
  if (dueDate) lines.push("", `Due: ${dueDate}`);

  const textRes = await fetch(`${MESSAGING}/api/v1/messages/${roomId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: lines.join("\n"),
      type: "assignment",
      metadata: { title, instructions: instructions || null, dueDate: dueDate || null },
      clientMessageId: randomUUID(),
    }),
  });
  const textData = await textRes.json();
  if (!textRes.ok) return NextResponse.json(textData, { status: textRes.status });

  if (file && file.size > 0) {
    const mediaForm = new FormData();
    mediaForm.append("file", file, file.name);
    mediaForm.append("clientMessageId", randomUUID());
    const mediaRes = await fetch(`${MESSAGING}/api/v1/messages/${roomId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: mediaForm,
    });
    const mediaData = await mediaRes.json();
    if (!mediaRes.ok) {
      // The announcement itself already went through — surface the
      // attachment failure separately rather than pretending the whole
      // thing failed.
      return NextResponse.json({ notice: textData.message, attachmentError: mediaData.error ?? "Attachment upload failed" }, { status: 207 });
    }
    return NextResponse.json({ notice: textData.message, attachment: mediaData.message }, { status: 201 });
  }

  return NextResponse.json({ notice: textData.message }, { status: 201 });
}

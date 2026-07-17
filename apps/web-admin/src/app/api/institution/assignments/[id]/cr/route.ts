import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const AUTH = process.env.AUTH_SERVICE_URL ?? "http://localhost";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/institution/assignments/[id]/cr">
) {
  const jar = await cookies();
  const token = jar.get("unichat_institution_token")?.value;
  const { id } = await context.params;
  const upstream = await fetch(`${AUTH}/api/v1/institution/assignments/${id}/cr`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (upstream.status === 204) return NextResponse.json({ success: true });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

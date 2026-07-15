import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const adminToken = request.cookies.get("unichat_admin_token")?.value;
  const institutionToken = request.cookies.get("unichat_institution_token")?.value;
  const { pathname } = request.nextUrl;

  // SuperAdmin routes
  if (pathname.startsWith("/dashboard") && !adminToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname === "/login" && adminToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Institution Admin routes
  if (pathname === "/admin-login") {
    if (institutionToken) return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !institutionToken) {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/admin/:path*", "/admin-login"],
};

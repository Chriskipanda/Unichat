(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push(["chunks/[root-of-the-server]__0j_ouyl._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/StudioProjects/Unichat/apps/web-admin/src/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/StudioProjects/Unichat/apps/web-admin/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/StudioProjects/Unichat/apps/web-admin/node_modules/next/dist/esm/server/web/spec-extension/response.js [middleware-edge] (ecmascript)");
;
function middleware(request) {
    const adminToken = request.cookies.get("unichat_admin_token")?.value;
    const institutionToken = request.cookies.get("unichat_institution_token")?.value;
    const { pathname } = request.nextUrl;
    // SuperAdmin routes
    if (pathname.startsWith("/dashboard") && !adminToken) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/login", request.url));
    }
    if (pathname === "/login" && adminToken) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/dashboard", request.url));
    }
    // Institution Admin routes
    if (pathname === "/admin-login") {
        if (institutionToken) return __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/admin", request.url));
        return __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !institutionToken) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/admin-login", request.url));
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        "/dashboard/:path*",
        "/login",
        "/admin/:path*",
        "/admin-login"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__0j_ouyl._.js.map
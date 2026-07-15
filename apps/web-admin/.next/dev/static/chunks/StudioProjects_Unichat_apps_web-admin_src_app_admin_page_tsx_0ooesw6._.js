(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AdminOverviewPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/StudioProjects/Unichat/apps/web-admin/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/StudioProjects/Unichat/apps/web-admin/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
function StatCard({ label, value, sub, color }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `rounded-xl p-5 text-white ${color}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm font-medium opacity-80",
                children: label
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 24,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-3xl font-bold mt-1",
                children: value
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            sub && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs opacity-70 mt-1",
                children: sub
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 26,
                columnNumber: 15
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
_c = StatCard;
function AdminOverviewPage() {
    _s();
    const [stats, setStats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [institutionName, setInstitutionName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AdminOverviewPage.useEffect": ()=>{
            Promise.all([
                fetch("/api/institution/me").then({
                    "AdminOverviewPage.useEffect": (r)=>r.json()
                }["AdminOverviewPage.useEffect"]),
                fetch("/api/institution/users").then({
                    "AdminOverviewPage.useEffect": (r)=>r.json()
                }["AdminOverviewPage.useEffect"]),
                fetch("/api/institution/clubs").then({
                    "AdminOverviewPage.useEffect": (r)=>r.json()
                }["AdminOverviewPage.useEffect"]),
                fetch("/api/institution/departments").then({
                    "AdminOverviewPage.useEffect": (r)=>r.json()
                }["AdminOverviewPage.useEffect"])
            ]).then({
                "AdminOverviewPage.useEffect": ([meData, usersData, clubsData, deptsData])=>{
                    if (meData.institution?.name) setInstitutionName(meData.institution.name);
                    const users = usersData.users ?? [];
                    const deptCount = (deptsData.faculties ?? []).reduce({
                        "AdminOverviewPage.useEffect.deptCount": (acc, f)=>acc + (f.departments?.length ?? 0)
                    }["AdminOverviewPage.useEffect.deptCount"], 0);
                    setStats({
                        totalUsers: users.length,
                        students: users.filter({
                            "AdminOverviewPage.useEffect": (u)=>u.role === "student"
                        }["AdminOverviewPage.useEffect"]).length,
                        staff: users.filter({
                            "AdminOverviewPage.useEffect": (u)=>u.role === "staff"
                        }["AdminOverviewPage.useEffect"]).length,
                        admins: users.filter({
                            "AdminOverviewPage.useEffect": (u)=>u.role === "admin"
                        }["AdminOverviewPage.useEffect"]).length,
                        totalClubs: clubsData.clubs?.length ?? 0,
                        totalDepartments: deptCount
                    });
                }
            }["AdminOverviewPage.useEffect"]);
        }
    }["AdminOverviewPage.useEffect"], []);
    if (!stats) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center justify-center h-64",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 62,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
            lineNumber: 61,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-2xl font-bold text-gray-900",
                        children: institutionName
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 70,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-gray-500 text-sm mt-1",
                        children: "Institution overview"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 71,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 lg:grid-cols-3 gap-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                        label: "Total Users",
                        value: stats.totalUsers,
                        color: "bg-gradient-to-br from-indigo-600 to-indigo-950"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 76,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                        label: "Students",
                        value: stats.students,
                        color: "bg-gradient-to-br from-blue-500 to-blue-900"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 77,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                        label: "Staff",
                        value: stats.staff,
                        color: "bg-gradient-to-br from-violet-500 to-violet-900"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                        label: "Admins",
                        value: stats.admins,
                        color: "bg-gradient-to-br from-indigo-400 to-indigo-800"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 79,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                        label: "Clubs",
                        value: stats.totalClubs,
                        color: "bg-gradient-to-br from-purple-500 to-purple-900"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatCard, {
                        label: "Departments",
                        value: stats.totalDepartments,
                        color: "bg-gradient-to-br from-slate-600 to-slate-900"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 75,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 lg:grid-cols-4 gap-4",
                children: [
                    {
                        href: "/admin/users",
                        label: "Manage Users",
                        desc: "Add students & staff"
                    },
                    {
                        href: "/admin/departments",
                        label: "Departments",
                        desc: "Faculties & departments"
                    },
                    {
                        href: "/admin/clubs",
                        label: "Clubs",
                        desc: "Student organizations"
                    },
                    {
                        href: "/admin/branding",
                        label: "Branding",
                        desc: "Colours, logo, fonts"
                    }
                ].map((link)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        href: link.href,
                        className: "bg-white border border-indigo-100 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "font-semibold text-gray-900 group-hover:text-indigo-700 text-sm",
                                children: link.label
                            }, void 0, false, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                                lineNumber: 97,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-gray-400 text-xs mt-0.5",
                                children: link.desc
                            }, void 0, false, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                                lineNumber: 98,
                                columnNumber: 13
                            }, this)
                        ]
                    }, link.href, true, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                        lineNumber: 92,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
                lineNumber: 85,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/admin/page.tsx",
        lineNumber: 68,
        columnNumber: 5
    }, this);
}
_s(AdminOverviewPage, "lnKH0tCX31FiS2ED4KC6HAXgXn8=");
_c1 = AdminOverviewPage;
var _c, _c1;
__turbopack_context__.k.register(_c, "StatCard");
__turbopack_context__.k.register(_c1, "AdminOverviewPage");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=StudioProjects_Unichat_apps_web-admin_src_app_admin_page_tsx_0ooesw6._.js.map
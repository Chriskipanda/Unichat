module.exports = [
"[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PlansPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/StudioProjects/Unichat/apps/web-admin/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
const PLANS = [
    {
        key: "starter",
        label: "Starter",
        price: "Free",
        priceNote: "No credit card required",
        bg: "bg-white",
        border: "border-green-200",
        headerBg: "bg-green-50",
        labelColor: "text-green-700",
        badgeBg: "bg-green-100 text-green-700",
        cta: "border-green-300 text-green-700 hover:bg-green-50",
        maxUsers: "500",
        features: [
            {
                label: "Up to 500 students & staff",
                included: true
            },
            {
                label: "Core messaging & chats",
                included: true
            },
            {
                label: "Academic groups",
                included: true
            },
            {
                label: "OTP authentication",
                included: true
            },
            {
                label: "Email support",
                included: true
            },
            {
                label: "Custom branding",
                included: false
            },
            {
                label: "Clubs & societies",
                included: false
            },
            {
                label: "Advanced analytics",
                included: false
            },
            {
                label: "Dedicated support",
                included: false
            },
            {
                label: "SLA guarantee",
                included: false
            }
        ]
    },
    {
        key: "growth",
        label: "Growth",
        price: "$199",
        priceNote: "per month",
        bg: "bg-white",
        border: "border-green-500 ring-2 ring-green-200",
        headerBg: "bg-gradient-to-r from-green-600 to-green-500",
        labelColor: "text-white",
        badgeBg: "bg-white/20 text-white",
        cta: "bg-green-600 text-white hover:bg-green-700",
        maxUsers: "5,000",
        popular: true,
        features: [
            {
                label: "Up to 5,000 students & staff",
                included: true
            },
            {
                label: "Core messaging & chats",
                included: true
            },
            {
                label: "Academic groups",
                included: true
            },
            {
                label: "OTP authentication",
                included: true
            },
            {
                label: "Priority email support",
                included: true
            },
            {
                label: "Custom branding",
                included: true
            },
            {
                label: "Clubs & societies",
                included: true
            },
            {
                label: "Advanced analytics",
                included: true
            },
            {
                label: "Dedicated support",
                included: false
            },
            {
                label: "SLA guarantee",
                included: false
            }
        ]
    },
    {
        key: "enterprise",
        label: "Enterprise",
        price: "Custom",
        priceNote: "contact sales",
        bg: "bg-green-950",
        border: "border-green-800",
        headerBg: "bg-green-900",
        labelColor: "text-green-100",
        badgeBg: "bg-green-800 text-green-200",
        cta: "bg-green-500 text-white hover:bg-green-400",
        maxUsers: "Unlimited",
        features: [
            {
                label: "Unlimited students & staff",
                included: true
            },
            {
                label: "Core messaging & chats",
                included: true
            },
            {
                label: "Academic groups",
                included: true
            },
            {
                label: "OTP authentication",
                included: true
            },
            {
                label: "24/7 phone support",
                included: true
            },
            {
                label: "Custom branding",
                included: true
            },
            {
                label: "Clubs & societies",
                included: true
            },
            {
                label: "Advanced analytics",
                included: true
            },
            {
                label: "Dedicated success manager",
                included: true
            },
            {
                label: "99.9% SLA guarantee",
                included: true
            }
        ]
    }
];
function Check({ ok, dark }) {
    if (ok) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
            className: `w-4 h-4 ${dark ? "text-green-400" : "text-green-600"}`,
            fill: "currentColor",
            viewBox: "0 0 20 20",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                fillRule: "evenodd",
                d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z",
                clipRule: "evenodd"
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                lineNumber: 86,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
            lineNumber: 85,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        className: "w-4 h-4 text-green-300",
        fill: "currentColor",
        viewBox: "0 0 20 20",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
            fillRule: "evenodd",
            d: "M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z",
            clipRule: "evenodd"
        }, void 0, false, {
            fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
            lineNumber: 92,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
        lineNumber: 91,
        columnNumber: 5
    }, this);
}
function PlansPage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-8 max-w-6xl",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-green-950 font-bold text-xl",
                        children: "Subscription Plans"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                        lineNumber: 102,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-green-500 text-sm mt-1",
                        children: "Plan tiers determine feature access and user limits per institution. Changes take effect immediately."
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                        lineNumber: 103,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-1 md:grid-cols-3 gap-6",
                children: PLANS.map((plan)=>{
                    const isDark = plan.key === "enterprise";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `rounded-2xl border overflow-hidden shadow-sm flex flex-col ${plan.bg} ${plan.border}`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: `${plan.headerBg} px-6 py-5`,
                                children: [
                                    plan.popular && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: `text-xs font-bold px-2.5 py-1 rounded-full mb-3 inline-block ${plan.badgeBg}`,
                                        children: "Most Popular"
                                    }, void 0, false, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 120,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: `text-xl font-bold ${plan.labelColor}`,
                                        children: plan.label
                                    }, void 0, false, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 124,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `text-3xl font-extrabold ${plan.labelColor}`,
                                                children: plan.price
                                            }, void 0, false, {
                                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                                lineNumber: 126,
                                                columnNumber: 19
                                            }, this),
                                            plan.priceNote && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `text-sm ml-1 ${isDark ? "text-green-500" : "text-green-400"}`,
                                                children: plan.priceNote
                                            }, void 0, false, {
                                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                                lineNumber: 128,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 125,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: `text-xs mt-1 ${isDark ? "text-green-600" : "text-green-400"}`,
                                        children: [
                                            "Up to ",
                                            plan.maxUsers,
                                            " users"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 133,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                lineNumber: 118,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 px-6 py-5 space-y-3",
                                children: plan.features.map((f)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2.5",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(Check, {
                                                ok: f.included,
                                                dark: isDark
                                            }, void 0, false, {
                                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                                lineNumber: 142,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `text-sm ${f.included ? isDark ? "text-green-200" : "text-green-900" : isDark ? "text-green-700" : "text-green-300"}`,
                                                children: f.label
                                            }, void 0, false, {
                                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                                lineNumber: 143,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, f.label, true, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 141,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                lineNumber: 139,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "px-6 pb-6",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: `w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${plan.cta}`,
                                    children: plan.key === "enterprise" ? "Contact Sales" : `Assign ${plan.label} Plan`
                                }, void 0, false, {
                                    fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                    lineNumber: 158,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                lineNumber: 157,
                                columnNumber: 15
                            }, this)
                        ]
                    }, plan.key, true, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                        lineNumber: 113,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                lineNumber: 109,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-green-50 border border-green-200 rounded-2xl px-6 py-5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-green-800 font-semibold text-sm mb-2",
                        children: "How plan assignment works"
                    }, void 0, false, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                        lineNumber: 171,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "space-y-1.5 text-green-700 text-sm",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "flex items-start gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-green-500 mt-0.5",
                                        children: "→"
                                    }, void 0, false, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 174,
                                        columnNumber: 13
                                    }, this),
                                    "Plans are assigned per institution from the Institutions page or via the plan selector in each row."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                lineNumber: 173,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "flex items-start gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-green-500 mt-0.5",
                                        children: "→"
                                    }, void 0, false, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 178,
                                        columnNumber: 13
                                    }, this),
                                    "Changes are applied immediately — no restart needed."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                lineNumber: 177,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                className: "flex items-start gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$StudioProjects$2f$Unichat$2f$apps$2f$web$2d$admin$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-green-500 mt-0.5",
                                        children: "→"
                                    }, void 0, false, {
                                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                        lineNumber: 182,
                                        columnNumber: 13
                                    }, this),
                                    "Institution admins see feature availability based on their assigned plan."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                                lineNumber: 181,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                        lineNumber: 172,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
                lineNumber: 170,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/StudioProjects/Unichat/apps/web-admin/src/app/dashboard/plans/page.tsx",
        lineNumber: 99,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=StudioProjects_Unichat_apps_web-admin_src_app_dashboard_plans_page_tsx_0y_s21e._.js.map
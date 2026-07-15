"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  planBreakdown: { starter: number; growth: number; enterprise: number };
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  _count: { users: number };
  createdAt: string;
};

function PlanBadge({ plan }: { plan: string }) {
  const s: Record<string, string> = {
    starter: "bg-green-100 text-green-700 border border-green-200",
    growth: "bg-green-200 text-green-800 border border-green-300",
    enterprise: "bg-green-700 text-white border border-green-700",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${s[plan] ?? s.starter}`}>
      {plan}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const dot: Record<string, string> = {
    active: "bg-green-500",
    pending: "bg-yellow-400",
    suspended: "bg-red-500",
    inactive: "bg-gray-400",
  };
  const text: Record<string, string> = {
    active: "text-green-700",
    pending: "text-yellow-700",
    suspended: "text-red-700",
    inactive: "text-gray-600",
  };
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium capitalize ${text[status] ?? text.inactive}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] ?? dot.inactive}`} />
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/tenants").then((r) => r.json()),
    ])
      .then(([s, t]) => {
        setStats(s);
        setTenants((t.tenants ?? []).slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Stats grid ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Institutions",
            value: stats?.activeTenants ?? 0,
            bg: "bg-gradient-to-br from-green-700 to-green-600",
            sub: `${stats?.totalTenants ?? 0} total`,
          },
          {
            label: "Total Users",
            value: stats?.totalUsers ?? 0,
            bg: "bg-gradient-to-br from-green-800 to-green-700",
            sub: "across all institutions",
          },
          {
            label: "Growth Plan",
            value: stats?.planBreakdown.growth ?? 0,
            bg: "bg-gradient-to-br from-green-900 to-green-800",
            sub: "institutions",
          },
          {
            label: "Enterprise Plan",
            value: stats?.planBreakdown.enterprise ?? 0,
            bg: "bg-gradient-to-br from-green-950 to-green-900",
            sub: "institutions",
          },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-2xl p-5 shadow-sm`}>
            <p className="text-green-300 text-xs font-medium">{card.label}</p>
            <p className="text-white text-4xl font-bold mt-1">{card.value}</p>
            <p className="text-green-500 text-xs mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            href: "/dashboard/institutions",
            title: "Add Institution",
            desc: "Register a new university or college on the platform",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            ),
            accent: "border-green-200 hover:border-green-500",
            iconBg: "bg-green-100 text-green-700",
          },
          {
            href: "/dashboard/plans",
            title: "Manage Plans",
            desc: "View and configure subscription tiers and features",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            accent: "border-green-200 hover:border-green-500",
            iconBg: "bg-green-100 text-green-700",
          },
          {
            href: "/dashboard/settings",
            title: "Platform Settings",
            desc: "Global feature flags and platform configuration",
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            ),
            accent: "border-green-200 hover:border-green-500",
            iconBg: "bg-green-100 text-green-700",
          },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`bg-white rounded-2xl border-2 p-5 transition-all hover:shadow-md ${a.accent}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${a.iconBg}`}>
              {a.icon}
            </div>
            <h3 className="text-green-900 font-semibold text-sm">{a.title}</h3>
            <p className="text-green-500 text-xs mt-1 leading-relaxed">{a.desc}</p>
          </Link>
        ))}
      </div>

      {/* ── Recent institutions table ───────────────── */}
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-green-100 flex items-center justify-between">
          <div>
            <h2 className="text-green-950 font-semibold text-sm">Recent Institutions</h2>
            <p className="text-green-400 text-xs mt-0.5">Latest additions to the platform</p>
          </div>
          <Link href="/dashboard/institutions" className="text-green-600 text-xs font-semibold hover:text-green-800 transition-colors">
            View all &rarr;
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-50 text-green-700 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Institution</th>
                <th className="px-6 py-3 text-left">Slug</th>
                <th className="px-6 py-3 text-left">Plan</th>
                <th className="px-6 py-3 text-left">Users</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-green-400 text-sm">
                    No institutions yet.{" "}
                    <Link href="/dashboard/institutions" className="text-green-600 underline font-medium">
                      Add the first one.
                    </Link>
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-green-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-green-900">{t.name}</td>
                    <td className="px-6 py-3.5 font-mono text-green-600 text-xs">{t.slug}</td>
                    <td className="px-6 py-3.5">
                      <PlanBadge plan={t.plan} />
                    </td>
                    <td className="px-6 py-3.5 text-green-700">{t._count?.users ?? 0}</td>
                    <td className="px-6 py-3.5">
                      <StatusDot status={t.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

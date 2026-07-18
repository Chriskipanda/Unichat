"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, TrendingUp, Crown, ArrowRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const ACCENT = "var(--color-auth-super)";

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

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-[var(--info)]/10 text-[var(--info)]",
  growth: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  enterprise: "bg-primary/10 text-primary",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-[var(--success)]/10 text-[var(--success)]",
  pending: "bg-[var(--warning)]/10 text-[var(--warning)]",
  suspended: "bg-destructive/10 text-destructive",
  inactive: "bg-muted text-muted-foreground",
};

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}

function StatCard({ label, value, sub, icon: Icon, color }: StatCardProps) {
  return (
    <Card className="p-4 gap-1">
      <div className="flex items-center justify-between">
        <p className="text-metadata font-medium">{label}</p>
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}1a` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground mt-1">{value}</p>
      {sub && <p className="text-metadata mt-0.5">{sub}</p>}
    </Card>
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
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h2 className="text-heading">UniChat Enterprise</h2>
        <p className="text-subtitle mt-1">Platform overview across every institution</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Active Institutions"
          value={stats?.activeTenants ?? 0}
          sub={`${stats?.totalTenants ?? 0} total`}
          icon={Building2}
          color={ACCENT}
        />
        <StatCard label="Total Users" value={stats?.totalUsers ?? 0} sub="across all institutions" icon={Users} color="var(--chart-2)" />
        <StatCard label="Growth Plan" value={stats?.planBreakdown.growth ?? 0} sub="institutions" icon={TrendingUp} color="var(--chart-3)" />
        <StatCard label="Enterprise Plan" value={stats?.planBreakdown.enterprise ?? 0} sub="institutions" icon={Crown} color="var(--chart-4)" />
      </div>

      <div>
        <h3 className="text-title mb-3">Quick links</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: "/dashboard/institutions", title: "Add Institution", desc: "Register a new university or college on the platform" },
            { href: "/dashboard/plans", title: "Manage Plans", desc: "View and configure subscription tiers and features" },
            { href: "/dashboard/settings", title: "Platform Settings", desc: "Global feature flags and platform configuration" },
          ].map((a) => (
            <Link key={a.href} href={a.href}>
              <Card className="p-4 gap-1 hover:ring-primary/30 hover:shadow-soft-sm transition-all group h-full">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ACCENT}1a` }}>
                    <Building2 className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="font-semibold text-foreground text-sm mt-2">{a.title}</p>
                <p className="text-metadata">{a.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden gap-0">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-title">Recent Institutions</h2>
            <p className="text-metadata mt-0.5">Latest additions to the platform</p>
          </div>
          <Link href="/dashboard/institutions" className="text-xs font-semibold hover:underline" style={{ color: ACCENT }}>
            View all &rarr;
          </Link>
        </div>

        {tenants.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No institutions yet.{" "}
            <Link href="/dashboard/institutions" className="underline font-medium" style={{ color: ACCENT }}>
              Add the first one.
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-table-header px-5">Institution</TableHead>
                <TableHead className="text-table-header px-5">Slug</TableHead>
                <TableHead className="text-table-header px-5">Plan</TableHead>
                <TableHead className="text-table-header px-5">Users</TableHead>
                <TableHead className="text-table-header px-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => (window.location.href = `/dashboard/institutions/${t.id}`)}>
                  <TableCell className="px-5 py-3.5 text-table-cell font-semibold">{t.name}</TableCell>
                  <TableCell className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{t.slug}</TableCell>
                  <TableCell className="px-5 py-3.5">
                    <Badge className={`${PLAN_BADGE[t.plan] ?? PLAN_BADGE.starter} capitalize`}>{t.plan}</Badge>
                  </TableCell>
                  <TableCell className="px-5 py-3.5 text-table-cell">{t._count?.users ?? 0}</TableCell>
                  <TableCell className="px-5 py-3.5">
                    <Badge className={`${STATUS_BADGE[t.status] ?? STATUS_BADGE.inactive} capitalize`}>{t.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

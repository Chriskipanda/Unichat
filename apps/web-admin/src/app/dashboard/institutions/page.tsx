"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const ACCENT = "var(--color-auth-super)";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  status: string;
  maxUsers: number;
  _count: { users: number };
  createdAt: string;
};

const PLANS = ["starter", "growth", "enterprise"];
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

export default function InstitutionsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading">Institutions</h2>
          <p className="text-subtitle">
            {tenants.length} institution{tenants.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} style={{ backgroundColor: ACCENT }}>
          <Plus />
          Add Institution
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
          className="pl-8"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {search ? "No institutions match your search." : "No institutions yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-table-header px-4">Institution</TableHead>
                <TableHead className="text-table-header px-4 hidden md:table-cell">Slug</TableHead>
                <TableHead className="text-table-header px-4 hidden lg:table-cell">Domain</TableHead>
                <TableHead className="text-table-header px-4">Plan</TableHead>
                <TableHead className="text-table-header px-4">Users / Max</TableHead>
                <TableHead className="text-table-header px-4">Status</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} className="cursor-pointer">
                  <TableCell className="px-4 py-3.5 text-table-cell font-semibold p-0">
                    <Link href={`/dashboard/institutions/${t.id}`} className="block px-4 py-3.5">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 font-mono text-muted-foreground text-xs hidden md:table-cell">{t.slug}</TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">{t.domain ?? "—"}</TableCell>
                  <TableCell className="px-4 py-3.5">
                    <Badge className={`${PLAN_BADGE[t.plan] ?? PLAN_BADGE.starter} capitalize`}>{t.plan}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-table-cell">
                    <span className="font-semibold">{t._count?.users ?? 0}</span>
                    <span className="text-muted-foreground"> / {t.maxUsers}</span>
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <Badge className={`${STATUS_BADGE[t.status] ?? STATUS_BADGE.inactive} capitalize`}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3.5">
                    <Link href={`/dashboard/institutions/${t.id}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {showModal && <AddModal onClose={() => setShowModal(false)} onSuccess={load} />}
    </div>
  );
}

function AddModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", domain: "", plan: "starter", maxUsers: "500" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        domain: form.domain || undefined,
        plan: form.plan,
        maxUsers: parseInt(form.maxUsers, 10),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create institution");
      return;
    }
    onSuccess();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Institution</DialogTitle>
          <DialogDescription>Register a new university or college</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Institution Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Arusha Technical College" required autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">Slug</Label>
            <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="atc" required />
          </div>
          <div>
            <Label className="mb-1.5">Domain (optional)</Label>
            <Input value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="atc.ac.tz" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5">Plan</Label>
              <Select value={form.plan} onValueChange={(v) => v && set("plan", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">Max Users</Label>
              <Input type="number" value={form.maxUsers} onChange={(e) => set("maxUsers", e.target.value)} min="10" max="100000" />
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1" style={{ backgroundColor: ACCENT }}>
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "Creating…" : "Create Institution"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

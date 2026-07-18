"use client";

import { useEffect, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
const PLANS = ["starter", "growth", "enterprise"];
const STATUSES = ["active", "pending", "suspended", "inactive"];

interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  status: string;
  maxUsers: number;
  _count: { users: number };
  createdAt: string;
}

interface StaffUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  staffId: string | null;
  role: "admin" | "teacher" | "staff";
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = { admin: "College Admin", teacher: "Teacher", staff: "Staff" };
const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/10 text-primary",
  teacher: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  staff: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
};

export default function InstitutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const router = useRouter();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", domain: "", plan: "starter", status: "active", maxUsers: "500" });
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);

  async function load() {
    setLoading(true);
    const [tRes, uRes] = await Promise.all([
      fetch(`/api/tenants/${id}`),
      fetch(`/api/tenants/${id}/users`),
    ]);
    const tData = await tRes.json();
    const uData = await uRes.json();
    if (tData.tenant) {
      setTenant(tData.tenant);
      setForm({
        name: tData.tenant.name,
        domain: tData.tenant.domain ?? "",
        plan: tData.tenant.plan,
        status: tData.tenant.status,
        maxUsers: String(tData.tenant.maxUsers),
      });
    }
    setUsers(uData.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        domain: form.domain || null,
        plan: form.plan,
        status: form.status,
        maxUsers: parseInt(form.maxUsers, 10),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save institution.");
      return;
    }
    setTenant(data.tenant);
  }

  async function deleteInstitution() {
    if (!confirm(`Permanently delete "${tenant?.name}" and every user, room, and message in it? This cannot be undone.`)) return;
    const res = await fetch(`/api/tenants/${id}`, { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      router.push("/dashboard/institutions");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Failed to delete institution.");
    }
  }

  async function toggleActive(u: StaffUser) {
    await fetch(`/api/tenants/${id}/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    load();
  }

  async function deleteUser(u: StaffUser) {
    if (!confirm(`Remove ${u.fullName} from this institution?`)) return;
    await fetch(`/api/tenants/${id}/users/${u.id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Institution not found.</div>;
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Link href="/dashboard/institutions" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Institutions
        </Link>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${ACCENT}1a` }}>
            <Building2 className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h2 className="text-heading">{tenant.name}</h2>
            <p className="text-subtitle">
              {tenant.slug} · {tenant._count?.users ?? 0} users
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="admins">Admins &amp; Staff</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-4">
          <Card className="p-6 max-w-lg">
            <form onSubmit={saveDetails} className="space-y-4">
              <div>
                <Label className="mb-1.5">Institution Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <Label className="mb-1.5">Slug</Label>
                <Input value={tenant.slug} disabled className="font-mono text-xs" />
                <p className="text-metadata mt-1">Used by the mobile app to identify the institution — cannot be changed.</p>
              </div>
              <div>
                <Label className="mb-1.5">Domain</Label>
                <Input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} placeholder="atc.ac.tz" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Plan</Label>
                  <Select value={form.plan} onValueChange={(v) => v && setForm((f) => ({ ...f, plan: v }))}>
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
                  <Label className="mb-1.5">Status</Label>
                  <Select value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5">Max Users</Label>
                <Input type="number" min="10" max="100000" value={form.maxUsers} onChange={(e) => setForm((f) => ({ ...f, maxUsers: e.target.value }))} />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={saving} style={{ backgroundColor: ACCENT }}>
                  {saving && <Loader2 className="animate-spin" />}
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-6 max-w-lg mt-5 border-destructive/30">
            <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
            <p className="text-metadata mt-1 mb-3">
              Permanently delete this institution, including every user, room, and message. This cannot be undone.
            </p>
            <Button variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" onClick={deleteInstitution}>
              <Trash2 />
              Delete Institution
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="admins" className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-subtitle">
              College admins and staff who can sign in to this institution&apos;s admin portal.
            </p>
            <Button onClick={() => setShowAddAdmin(true)} style={{ backgroundColor: ACCENT }}>
              <Plus />
              Add Admin
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No admins yet. This institution has no one who can sign in to manage it.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-table-header px-4">Name</TableHead>
                    <TableHead className="text-table-header px-4 hidden md:table-cell">Contact</TableHead>
                    <TableHead className="text-table-header px-4">Role</TableHead>
                    <TableHead className="text-table-header px-4">Status</TableHead>
                    <TableHead className="px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="px-4 py-3 text-table-cell font-medium">{u.fullName}</TableCell>
                      <TableCell className="px-4 py-3 text-table-cell text-muted-foreground hidden md:table-cell">
                        {u.email || u.phone || u.staffId || "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={ROLE_BADGE[u.role] ?? "bg-muted text-muted-foreground"}>
                          {u.role === "admin" && <ShieldCheck className="w-3 h-3" />}
                          {ROLE_LABEL[u.role] ?? u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <button onClick={() => toggleActive(u)}>
                          <Badge className={u.isActive ? "bg-[var(--success)]/10 text-[var(--success)] cursor-pointer" : "bg-destructive/10 text-destructive cursor-pointer"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditingUser(u)} title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => deleteUser(u)} title="Remove" className="hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {showAddAdmin && <AdminModal tenantId={id} onClose={() => setShowAddAdmin(false)} onSaved={load} />}
      {editingUser && <AdminModal tenantId={id} user={editingUser} onClose={() => setEditingUser(null)} onSaved={load} />}
    </div>
  );
}

function AdminModal({
  tenantId,
  user,
  onClose,
  onSaved,
}: {
  tenantId: string;
  user?: StaffUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    staffId: user?.staffId ?? "",
    role: user?.role ?? "admin",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const url = isEdit ? `/api/tenants/${tenantId}/users/${user!.id}` : `/api/tenants/${tenantId}/users`;
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save.");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Admin" : "Add Admin"}</DialogTitle>
          <DialogDescription>Grants sign-in access to this institution&apos;s admin or teacher portal.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Full Name</Label>
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5">Phone</Label>
            <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="255XXXXXXXXX" />
          </div>
          <div>
            <Label className="mb-1.5">Staff ID</Label>
            <Input value={form.staffId} onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5">Role</Label>
            <Select value={form.role} onValueChange={(v) => v && setForm((f) => ({ ...f, role: v as StaffUser["role"] }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">College Admin</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1" style={{ backgroundColor: ACCENT }}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Department {
  id: string;
  name: string;
}

interface Faculty {
  id: string;
  name: string;
  departments: Department[];
}

interface Course {
  id: string;
  name: string;
  department: { id: string; name: string };
}

// Standard NACTE/VETA-style NTA bands — mirrors the teacher portal's list so
// a programme + level picked here matches what students/teachers see there.
const DIPLOMA_LEVELS = ["NTA Level 4", "NTA Level 5", "NTA Level 6"];
const BACHELOR_LEVELS = ["NTA Level 7-1", "NTA Level 7-2", "NTA Level 8"];

function levelsForProgramme(name: string): string[] {
  const n = name.toLowerCase();
  if (n.includes("bachelor")) return BACHELOR_LEVELS;
  if (n.includes("diploma")) return DIPLOMA_LEVELS;
  return [...DIPLOMA_LEVELS, ...BACHELOR_LEVELS];
}

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  studentId?: string;
  staffId?: string;
  course?: string;
  ntaLevel?: string;
  role: "student" | "teacher" | "staff" | "admin" | "class_rep";
  department?: Department | null;
  isActive: boolean;
  createdAt: string;
}

const ROLE_TABS = ["all", "student", "teacher", "admin"] as const;
type RoleTab = (typeof ROLE_TABS)[number];

// Display label for a role value (handles legacy "staff" from DB)
function roleLabel(role: string) {
  if (role === "staff" || role === "teacher") return "Teacher";
  if (role === "admin") return "Admin";
  if (role === "class_rep") return "Class Rep";
  return "Student";
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  student: "bg-[var(--info)]/10 text-[var(--info)]",
  teacher: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  staff: "bg-[var(--chart-3)]/10 text-[var(--chart-3)]",
  admin: "bg-primary/10 text-primary",
  class_rep: "bg-[var(--warning)]/10 text-[var(--warning)]",
};

const SENTINEL_NONE = "__none__";

function fromSelectValue(v: string | null): string {
  return v === SENTINEL_NONE || v == null ? "" : v;
}

interface AddModalProps {
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}

function AddModal({ departments, onClose, onCreated }: AddModalProps) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    studentId: "",
    role: "student" as "student" | "teacher",
    departmentId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create user.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Full Name</Label>
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5">Phone</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="255XXXXXXXXX"
            />
          </div>
          <div>
            <Label className="mb-1.5">Student / Staff ID</Label>
            <Input
              value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              placeholder="e.g. STU001 or TCH042"
            />
          </div>
          <div>
            <Label className="mb-1.5">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "student" | "teacher" }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role === "teacher" && (
            <div>
              <Label className="mb-1.5">Department</Label>
              <Select
                value={form.departmentId || SENTINEL_NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: fromSelectValue(v) }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINEL_NONE}>No department yet</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Creating…" : "Add User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditModalProps {
  user: User;
  departments: Department[];
  courses: Course[];
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ user, departments, courses, onClose, onSaved }: EditModalProps) {
  const isTeacher = user.role === "teacher" || user.role === "staff";
  const [form, setForm] = useState({
    fullName: user.fullName,
    email: user.email ?? "",
    phone: user.phone ?? "",
    studentId: user.studentId ?? "",
    staffId: user.staffId ?? "",
    course: user.course ?? "",
    ntaLevel: user.ntaLevel ?? "",
    departmentId: user.department?.id ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableLevels = form.course ? levelsForProgramme(form.course) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/institution/users/${user.id}`, {
      method: "PATCH",
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>{roleLabel(user.role)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Full Name</Label>
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5">Phone</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="255XXXXXXXXX"
            />
          </div>
          <div>
            <Label className="mb-1.5">Student ID</Label>
            <Input value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5">Staff ID</Label>
            <Input value={form.staffId} onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))} />
          </div>
          <div>
            <Label className="mb-1.5">{isTeacher ? "Programme Taught" : "Programme / Course"}</Label>
            <Select
              value={form.course || SENTINEL_NONE}
              onValueChange={(v) => setForm((f) => ({ ...f, course: fromSelectValue(v), ntaLevel: "" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_NONE}>No programme</SelectItem>
                {form.course && !courses.some((c) => c.name === form.course) && (
                  <SelectItem value={form.course}>{form.course} (custom)</SelectItem>
                )}
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name} — {c.department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5">NTA Level</Label>
            <Select
              value={form.ntaLevel || SENTINEL_NONE}
              onValueChange={(v) => setForm((f) => ({ ...f, ntaLevel: fromSelectValue(v) }))}
              disabled={!form.course}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={form.course ? "No level" : "Pick a programme first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL_NONE}>{form.course ? "No level" : "Pick a programme first"}</SelectItem>
                {form.ntaLevel && !availableLevels.includes(form.ntaLevel) && (
                  <SelectItem value={form.ntaLevel}>{form.ntaLevel} (custom)</SelectItem>
                )}
                {availableLevels.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {lvl}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isTeacher && (
            <div>
              <Label className="mb-1.5">Department</Label>
              <Select
                value={form.departmentId || SENTINEL_NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, departmentId: fromSelectValue(v) }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SENTINEL_NONE}>No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1">
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RoleTab>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  async function load() {
    setLoading(true);
    const [usersRes, deptRes, coursesRes] = await Promise.all([
      fetch("/api/institution/users"),
      fetch("/api/institution/departments"),
      fetch("/api/institution/courses"),
    ]);
    const usersData = await usersRes.json();
    const deptData = await deptRes.json();
    const coursesData = await coursesRes.json();
    setUsers(usersData.users ?? []);
    setDepartments(((deptData.faculties ?? []) as Faculty[]).flatMap((f) => f.departments));
    setCourses(coursesData.courses ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(user: User) {
    await fetch(`/api/institution/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    load();
  }

  async function assignDepartment(user: User, departmentId: string) {
    await fetch(`/api/institution/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId: departmentId || null }),
    });
    load();
  }

  async function assignProgramme(user: User, course: string) {
    // Changing programme invalidates whatever NTA level was picked for the
    // old one (a Diploma level doesn't apply to a Bachelor programme).
    await fetch(`/api/institution/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course: course || null, ntaLevel: null }),
    });
    load();
  }

  async function assignNtaLevel(user: User, ntaLevel: string) {
    await fetch(`/api/institution/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ntaLevel: ntaLevel || null }),
    });
    load();
  }

  async function deleteUser(id: string) {
    if (!confirm("Remove this user from the institution?")) return;
    await fetch(`/api/institution/users/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = users.filter((u) => {
    // "teacher" tab matches both "teacher" and legacy "staff" values
    const matchesTab =
      tab === "all" ||
      (tab === "teacher" && (u.role === "teacher" || u.role === "staff")) ||
      (tab === "student" && (u.role === "student" || u.role === "class_rep")) ||
      u.role === tab;
    const matchesSearch =
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.studentId?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-heading">Users</h2>
          <p className="text-subtitle">{users.length} total</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus />
          Add User
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as RoleTab)}>
          <TabsList>
            {ROLE_TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t === "teacher" ? "Teachers" : t === "student" ? "Students" : t === "admin" ? "Admins" : "All"}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or ID…"
            className="pl-8"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No users found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-table-header px-4">Name</TableHead>
                <TableHead className="text-table-header px-4 hidden md:table-cell">Contact / ID</TableHead>
                <TableHead className="text-table-header px-4">Role</TableHead>
                <TableHead className="text-table-header px-4 hidden lg:table-cell">Department</TableHead>
                <TableHead className="text-table-header px-4 hidden xl:table-cell">Programme</TableHead>
                <TableHead className="text-table-header px-4 hidden xl:table-cell">NTA Level</TableHead>
                <TableHead className="text-table-header px-4">Status</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="px-4 py-3 text-table-cell font-medium">{u.fullName}</TableCell>
                  <TableCell className="px-4 py-3 text-table-cell text-muted-foreground hidden md:table-cell">
                    {u.email || u.studentId || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge className={ROLE_BADGE_CLASS[u.role] ?? "bg-muted text-muted-foreground"}>
                      {roleLabel(u.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden lg:table-cell">
                    {u.role === "teacher" || u.role === "staff" ? (
                      <select
                        value={u.department?.id ?? ""}
                        onChange={(e) => assignDepartment(u, e.target.value)}
                        className="border border-input rounded-md px-2 py-1 text-xs text-foreground bg-transparent outline-none focus:border-primary"
                      >
                        <option value="">Unassigned</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden xl:table-cell">
                    {u.role !== "admin" ? (
                      <select
                        value={u.course ?? ""}
                        onChange={(e) => assignProgramme(u, e.target.value)}
                        className="border border-input rounded-md px-2 py-1 text-xs text-foreground bg-transparent outline-none focus:border-primary max-w-[180px]"
                      >
                        <option value="">No programme</option>
                        {u.course && !courses.some((c) => c.name === u.course) && (
                          <option value={u.course}>{u.course} (custom)</option>
                        )}
                        {courses.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 hidden xl:table-cell">
                    {u.role !== "admin" ? (
                      <select
                        value={u.ntaLevel ?? ""}
                        onChange={(e) => assignNtaLevel(u, e.target.value)}
                        disabled={!u.course}
                        className="border border-input rounded-md px-2 py-1 text-xs text-foreground bg-transparent outline-none focus:border-primary disabled:opacity-50"
                      >
                        <option value="">{u.course ? "No level" : "—"}</option>
                        {u.ntaLevel && !levelsForProgramme(u.course ?? "").includes(u.ntaLevel) && (
                          <option value={u.ntaLevel}>{u.ntaLevel} (custom)</option>
                        )}
                        {levelsForProgramme(u.course ?? "").map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <button onClick={() => toggleActive(u)}>
                      <Badge
                        className={
                          u.isActive
                            ? "bg-[var(--success)]/10 text-[var(--success)] cursor-pointer"
                            : "bg-destructive/10 text-destructive cursor-pointer"
                        }
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(u)} title="Edit user">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteUser(u.id)}
                        title="Remove user"
                        className="hover:text-destructive"
                      >
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

      {showAdd && <AddModal departments={departments} onClose={() => setShowAdd(false)} onCreated={load} />}
      {editing && (
        <EditModal
          user={editing}
          departments={departments}
          courses={courses}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

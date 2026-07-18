"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  MessageCircle,
  Users,
  Camera,
  PartyPopper,
  Crown,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const ACCENT = "var(--color-auth-teacher)";

interface Teacher {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  avatarUrl?: string | null;
  department?: { id: string; name: string } | null;
}

interface Club {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  isJoined: boolean;
  isOwner: boolean;
}

interface RosterMember {
  id: string;
  fullName: string;
  studentId?: string | null;
  staffId?: string | null;
  role: string;
  avatarUrl?: string | null;
  roomRole: string;
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface Course {
  id: string;
  name: string;
  department: { id: string; name: string };
}

interface Cr {
  id: string;
  fullName: string;
  studentId?: string;
  phone?: string;
}

interface Room {
  id: string;
  name: string;
  _count: { members: number };
}

interface Assignment {
  id: string;
  ntaLevel: string;
  moduleName: string | null; // null only for rows created before this field existed
  course: Course;
  cr: Cr | null;
  group: Room | null;
}

interface Student {
  id: string;
  fullName: string;
  studentId?: string;
  course?: string;
  ntaLevel?: string;
  role: string;
}

// Standard NACTE/VETA-style NTA bands — which ones apply depends on the
// programme level: Ordinary Diploma runs NTA 4-6, Bachelor Degree runs
// NTA 7-1/7-2/8. "Other" always stays available as a free-text fallback.
const DIPLOMA_LEVELS = ["NTA Level 4", "NTA Level 5", "NTA Level 6"];
const BACHELOR_LEVELS = ["NTA Level 7-1", "NTA Level 7-2", "NTA Level 8"];
const OTHER = "__other__";

function levelsForCourse(course: Course | undefined): string[] {
  const name = course?.name.toLowerCase() ?? "";
  if (name.includes("bachelor")) return BACHELOR_LEVELS;
  if (name.includes("ordinary diploma") || name.includes("diploma")) return DIPLOMA_LEVELS;
  return [...DIPLOMA_LEVELS, ...BACHELOR_LEVELS]; // unrecognised naming — offer everything
}

function AddAssignmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [ntaLevel, setNtaLevel] = useState("");
  const [ntaLevelOther, setNtaLevelOther] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []));
  }, []);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const availableLevels = levelsForCourse(selectedCourse);

  function handleCourseChange(id: string) {
    setCourseId(id);
    // A level picked for the previous course may not apply to this one
    // (e.g. switching from a Diploma to a Bachelor programme).
    setNtaLevel("");
    setNtaLevelOther(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, ntaLevel, moduleName }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to add.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Course Assignment</DialogTitle>
        </DialogHeader>
        {courses.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">No courses in the catalog yet. Ask your institution admin to add one first.</p>
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5">Course</Label>
              <Select value={courseId} onValueChange={(v) => v && handleCourseChange(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">NTA Level</Label>
              <Select
                value={ntaLevelOther ? OTHER : ntaLevel}
                onValueChange={(v) => {
                  if (v === OTHER) {
                    setNtaLevelOther(true);
                    setNtaLevel("");
                  } else if (v) {
                    setNtaLevelOther(false);
                    setNtaLevel(v);
                  }
                }}
                disabled={!courseId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={courseId ? "Select NTA level…" : "Select a course first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableLevels.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other…</SelectItem>
                </SelectContent>
              </Select>
              {ntaLevelOther && (
                <Input
                  value={ntaLevel}
                  onChange={(e) => setNtaLevel(e.target.value)}
                  placeholder="e.g. NTA Level 9"
                  className="mt-2"
                  required
                  autoFocus
                />
              )}
            </div>
            <div>
              <Label className="mb-1.5">Module / Subject</Label>
              <Input value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="e.g. Database Systems" required />
              <p className="text-metadata mt-1">The specific subject you teach within this programme + level. Creates that class&apos;s chat room.</p>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1" style={{ backgroundColor: ACCENT }}>
                {saving && <Loader2 className="animate-spin" />}
                {saving ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignCrModal({
  assignment,
  onClose,
  onAssigned,
}: {
  assignment: Assignment;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState("");

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const params = new URLSearchParams({ search, assignmentId: assignment.id });
      fetch(`/api/teacher/students?${params}`)
        .then((r) => r.json())
        .then((d) => setStudents(d.students ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search, assignment.id]);

  async function assign(studentUserId: string) {
    setAssigning(studentUserId);
    await fetch(`/api/teacher/assignments/${assignment.id}/cr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentUserId }),
    });
    setAssigning("");
    onAssigned();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Class Representative</DialogTitle>
          <DialogDescription>
            {assignment.moduleName ?? "Untitled module"} · {assignment.course.name} · {assignment.ntaLevel}
            <br />
            Showing students whose course + NTA level match this class.
          </DialogDescription>
        </DialogHeader>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student by name or ID…"
            className="pl-8"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-24">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No students found.</p>
          ) : (
            <div className="space-y-0.5">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => assign(s.id)}
                  disabled={assigning !== ""}
                  className="w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                    <p className="text-metadata">
                      {s.studentId ?? "—"}
                      {s.role === "class_rep" ? " · Currently a CR" : ""}
                    </p>
                  </div>
                  {assigning === s.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT }} />
                  ) : (
                    <span className="text-xs font-medium" style={{ color: ACCENT }}>
                      Select
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={onClose} className="shrink-0">
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function RoomMembersDialog({
  roomId,
  roomName,
  onClose,
}: {
  roomId: string;
  roomName: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<RosterMember[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/teacher/rooms/${roomId}/members`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setMembers(d.members ?? []);
      })
      .catch(() => setError("Failed to load members."));
  }, [roomId]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{roomName}</DialogTitle>
          <DialogDescription>{members ? `${members.length} member${members.length === 1 ? "" : "s"}` : "Loading roster…"}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-24">
          {error ? (
            <p className="text-sm text-destructive text-center py-8">{error}</p>
          ) : !members ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>
          ) : (
            <div className="space-y-0.5">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                  <Avatar className="size-8">
                    {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.fullName} />}
                    <AvatarFallback className="text-xs font-semibold">{initialsOf(m.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.fullName}</p>
                    <p className="text-metadata">{m.studentId ?? m.staffId ?? "—"}</p>
                  </div>
                  {(m.roomRole === "owner" || m.role === "class_rep") && (
                    <Badge className="bg-[var(--warning)]/10 text-[var(--warning)] shrink-0">
                      {m.roomRole === "owner" ? "Owner" : "Class Rep"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={onClose} className="shrink-0">
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function AddClubModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/teacher/clubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to create club.");
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Club</DialogTitle>
          <DialogDescription>You&apos;re automatically the owner and first member.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Debate Club" required autoFocus />
          </div>
          <div>
            <Label className="mb-1.5">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this club about?"
              rows={3}
              className="resize-none"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="-mx-0 -mb-0 border-t-0 bg-transparent p-0 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1" style={{ backgroundColor: ACCENT }}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeacherPortalPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddClub, setShowAddClub] = useState(false);
  const [crTarget, setCrTarget] = useState<Assignment | null>(null);
  const [rosterTarget, setRosterTarget] = useState<{ id: string; name: string } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/teacher/me");
    const data = await res.json();
    setTeacher(data.teacher ?? null);
    setAssignments(data.assignments ?? []);
    setLoading(false);
  }

  async function loadClubs() {
    setClubsLoading(true);
    const res = await fetch("/api/teacher/clubs");
    const data = await res.json();
    setClubs(data.clubs ?? []);
    setClubsLoading(false);
  }

  useEffect(() => {
    load();
    loadClubs();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setAvatarError("Only PNG, JPEG or WebP images accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Photo must be under 2 MB.");
      return;
    }
    setAvatarError("");
    setUploadingAvatar(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/teacher/avatar", { method: "POST", body: form });
    const data = await res.json();
    setUploadingAvatar(false);
    if (res.ok && data.teacher) {
      setTeacher(data.teacher);
    } else {
      setAvatarError(data.error ?? "Upload failed.");
    }
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  async function deleteClub(id: string) {
    if (!confirm("Delete this club? This removes it for every member.")) return;
    await fetch(`/api/teacher/clubs/${id}`, { method: "DELETE" });
    loadClubs();
  }

  async function removeAssignment(id: string) {
    if (
      !confirm(
        "Remove this course assignment? The Class Rep for it (if any) will lose that role, unless they hold it for another assignment too."
      )
    )
      return;
    await fetch(`/api/teacher/assignments/${id}`, { method: "DELETE" });
    load();
  }

  async function removeCr(id: string) {
    if (!confirm("Remove the Class Representative for this assignment?")) return;
    await fetch(`/api/teacher/assignments/${id}/cr`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-title mb-4">My Profile</h2>
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <Avatar className="size-16">
              {teacher?.avatarUrl && <AvatarImage src={teacher.avatarUrl} alt={teacher.fullName} />}
              <AvatarFallback className="text-lg font-semibold">{teacher ? initialsOf(teacher.fullName) : ""}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-background"
              style={{ backgroundColor: ACCENT }}
              title="Change photo"
            >
              {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex-1 min-w-0">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-metadata">Full Name</dt>
                <dd className="text-foreground font-medium">{teacher?.fullName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata">Email</dt>
                <dd className="text-foreground font-medium">{teacher?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata">Phone</dt>
                <dd className="text-foreground font-medium">{teacher?.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-metadata">Department</dt>
                <dd className="text-foreground font-medium">{teacher?.department?.name ?? "Not assigned yet"}</dd>
              </div>
            </dl>
            {avatarError && <p className="text-destructive text-xs mt-2">{avatarError}</p>}
            <p className="text-metadata mt-3">Contact your institution admin to update your name, email, phone, or department.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-title">Courses I Teach</h2>
            <p className="text-subtitle mt-0.5">
              Register a module you teach + its programme and NTA level — this creates that class&apos;s chat room, and you can assign
              a Class Rep for it.
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)} className="shrink-0" style={{ backgroundColor: ACCENT }}>
            <Plus />
            Add
          </Button>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No course assignments yet. Add the course and NTA level you teach to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <div key={a.id} className="border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground text-sm">
                      {a.moduleName ?? <span className="italic text-muted-foreground font-normal">Untitled module — remove and re-add to name it</span>}
                    </p>
                    <p className="text-metadata">
                      {a.course.name} · {a.course.department.name} · {a.ntaLevel}
                    </p>
                    {a.group && (
                      <button
                        type="button"
                        onClick={() => setRosterTarget({ id: a.group!.id, name: a.moduleName ?? a.course.name })}
                        className="text-xs mt-1 flex items-center gap-1 hover:underline"
                        style={{ color: ACCENT }}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Class room · {a.group._count.members} member{a.group._count.members === 1 ? "" : "s"}
                      </button>
                    )}
                  </div>
                  <Button variant="ghost" size="icon-sm" className="hover:text-destructive shrink-0" onClick={() => removeAssignment(a.id)} title="Remove assignment">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
                  {a.cr ? (
                    <div>
                      <p className="text-metadata">Class Rep</p>
                      <p className="text-sm font-medium text-foreground">
                        {a.cr.fullName} <span className="text-muted-foreground font-normal">{a.cr.studentId ? `· ${a.cr.studentId}` : ""}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No Class Rep assigned</p>
                  )}
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setCrTarget(a)} style={{ color: ACCENT }}>
                      <Users className="w-3.5 h-3.5" />
                      {a.cr ? "Change" : "Assign CR"}
                    </Button>
                    {a.cr && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeCr(a.id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-title">Clubs</h2>
            <p className="text-subtitle mt-0.5">Every club in your institution. Create one to open its chat room instantly.</p>
          </div>
          <Button onClick={() => setShowAddClub(true)} className="shrink-0" style={{ backgroundColor: ACCENT }}>
            <Plus />
            Create
          </Button>
        </div>

        {clubsLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: ACCENT }} />
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No clubs yet. Create the first one for your institution.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {clubs.map((c) => (
              <div key={c.id} className="border border-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PartyPopper className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                    <p className="font-semibold text-foreground text-sm truncate">{c.name}</p>
                  </div>
                  {c.isOwner && (
                    <Badge className="bg-[var(--warning)]/10 text-[var(--warning)] shrink-0">
                      <Crown className="w-3 h-3" />
                      Yours
                    </Badge>
                  )}
                </div>
                {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <p className="text-metadata">
                    {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRosterTarget({ id: c.id, name: c.name })}>
                      <Eye className="w-3.5 h-3.5" />
                      Members
                    </Button>
                    {c.isOwner && (
                      <Button variant="ghost" size="icon-sm" className="hover:text-destructive" onClick={() => deleteClub(c.id)} title="Delete club">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAdd && <AddAssignmentModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {crTarget && <AssignCrModal assignment={crTarget} onClose={() => setCrTarget(null)} onAssigned={load} />}
      {showAddClub && <AddClubModal onClose={() => setShowAddClub(false)} onCreated={loadClubs} />}
      {rosterTarget && (
        <RoomMembersDialog roomId={rosterTarget.id} roomName={rosterTarget.name} onClose={() => setRosterTarget(null)} />
      )}
    </div>
  );
}

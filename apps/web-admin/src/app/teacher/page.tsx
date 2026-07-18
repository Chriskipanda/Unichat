"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search, Loader2, MessageCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

const ACCENT = "var(--color-auth-teacher)";

interface Teacher {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  department?: { id: string; name: string } | null;
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

export default function TeacherPortalPage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [crTarget, setCrTarget] = useState<Assignment | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/teacher/me");
    const data = await res.json();
    setTeacher(data.teacher ?? null);
    setAssignments(data.assignments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

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
        <p className="text-metadata mt-4">Contact your institution admin to update your name, email, phone, or department.</p>
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
                      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: ACCENT }}>
                        <MessageCircle className="w-3.5 h-3.5" />
                        Class room · {a.group._count.members} member{a.group._count.members === 1 ? "" : "s"}
                      </p>
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

      {showAdd && <AddAssignmentModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {crTarget && <AssignCrModal assignment={crTarget} onClose={() => setCrTarget(null)} onAssigned={load} />}
    </div>
  );
}

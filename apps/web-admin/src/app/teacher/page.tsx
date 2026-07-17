"use client";

import { useEffect, useState } from "react";

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

interface Assignment {
  id: string;
  ntaLevel: string;
  course: Course;
  cr: Cr | null;
}

interface Student {
  id: string;
  fullName: string;
  studentId?: string;
  course?: string;
  ntaLevel?: string;
  role: string;
}

// Standard NACTE/VETA-style NTA bands. "Other" falls back to free text so an
// unusual level (or a future band) never blocks registering an assignment.
const NTA_LEVELS = ["NTA Level 4", "NTA Level 5", "NTA Level 6", "NTA Level 7-1", "NTA Level 7-2", "NTA Level 8-1", "NTA Level 8-2"];

function AddAssignmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [ntaLevel, setNtaLevel] = useState("");
  const [ntaLevelOther, setNtaLevelOther] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/teacher/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, ntaLevel }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to add."); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add Course Assignment</h3>
        {courses.length === 0 ? (
          <p className="text-sm text-gray-500">
            No courses in the catalog yet. Ask your institution admin to add one first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              >
                <option value="">Select course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.department.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NTA Level</label>
              <select
                value={ntaLevelOther ? "__other__" : ntaLevel}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__other__") { setNtaLevelOther(true); setNtaLevel(""); }
                  else { setNtaLevelOther(false); setNtaLevel(v); }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required={!ntaLevelOther}
              >
                <option value="">Select NTA level…</option>
                {NTA_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
                <option value="__other__">Other…</option>
              </select>
              {ntaLevelOther && (
                <input
                  type="text"
                  value={ntaLevel}
                  onChange={(e) => setNtaLevel(e.target.value)}
                  placeholder="e.g. NTA Level 9"
                  className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              )}
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}
        {courses.length === 0 && (
          <button onClick={onClose} className="w-full mt-4 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
        )}
      </div>
    </div>
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
      fetch(`/api/teacher/students?search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((d) => setStudents(d.students ?? []))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 max-h-[80vh] flex flex-col">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Assign Class Representative</h3>
        <p className="text-sm text-gray-500 mb-4">{assignment.course.name} · {assignment.ntaLevel}</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student by name or ID…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
          autoFocus
        />
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No students found.</p>
          ) : (
            <div className="space-y-1">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => assign(s.id)}
                  disabled={assigning !== ""}
                  className="w-full flex items-center justify-between text-left px-3 py-2.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                    <p className="text-xs text-gray-500">{s.studentId ?? "—"}{s.role === "class_rep" ? " · Currently a CR" : ""}</p>
                  </div>
                  {assigning === s.id ? (
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-xs font-medium text-emerald-600">Select</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClose} className="mt-4 w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
      </div>
    </div>
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

  useEffect(() => { load(); }, []);

  async function removeAssignment(id: string) {
    if (!confirm("Remove this course assignment? The Class Rep for it (if any) will lose that role, unless they hold it for another assignment too.")) return;
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
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile */}
      <div className="bg-white border border-emerald-100 rounded-xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">My Profile</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">Full Name</dt>
            <dd className="text-gray-900 font-medium">{teacher?.fullName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900 font-medium">{teacher?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Phone</dt>
            <dd className="text-gray-900 font-medium">{teacher?.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Department</dt>
            <dd className="text-gray-900 font-medium">{teacher?.department?.name ?? "Not assigned yet"}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-400 mt-4">
          Contact your institution admin to update your name, email, phone, or department.
        </p>
      </div>

      {/* Assignments */}
      <div className="bg-white border border-emerald-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Courses I Teach</h2>
            <p className="text-sm text-gray-500">Register a course + NTA level, and assign a Class Rep for each.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            No course assignments yet. Add the course and NTA level you teach to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <div key={a.id} className="border border-emerald-100 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{a.course.name}</p>
                    <p className="text-xs text-gray-500">{a.course.department.name} · {a.ntaLevel}</p>
                  </div>
                  <button
                    onClick={() => removeAssignment(a.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded"
                    title="Remove assignment"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-emerald-50 flex items-center justify-between">
                  {a.cr ? (
                    <div>
                      <p className="text-xs text-gray-500">Class Rep</p>
                      <p className="text-sm font-medium text-gray-900">{a.cr.fullName} <span className="text-gray-400 font-normal">{a.cr.studentId ? `· ${a.cr.studentId}` : ""}</span></p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No Class Rep assigned</p>
                  )}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setCrTarget(a)}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-50"
                    >
                      {a.cr ? "Change" : "Assign CR"}
                    </button>
                    {a.cr && (
                      <button
                        onClick={() => removeCr(a.id)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddAssignmentModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {crTarget && <AssignCrModal assignment={crTarget} onClose={() => setCrTarget(null)} onAssigned={load} />}
    </div>
  );
}

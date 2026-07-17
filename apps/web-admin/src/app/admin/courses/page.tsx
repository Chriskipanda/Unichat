"use client";

import { useEffect, useState } from "react";

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
  department: Department;
}

function AddCourseModal({
  departments,
  onClose,
  onCreated,
}: {
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, departmentId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add Course</h3>
        {departments.length === 0 ? (
          <p className="text-sm text-gray-500 mb-4">
            Add a department first — courses belong to a department.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Course name, e.g. Bachelor Degree in Computer Science"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              required
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}
        {departments.length === 0 && (
          <button onClick={onClose} className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Close</button>
        )}
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const [coursesRes, deptRes] = await Promise.all([
      fetch("/api/institution/courses"),
      fetch("/api/institution/departments"),
    ]);
    const coursesData = await coursesRes.json();
    const deptData = await deptRes.json();
    setCourses(coursesData.courses ?? []);
    const flatDepartments = ((deptData.faculties ?? []) as Faculty[]).flatMap((f) => f.departments);
    setDepartments(flatDepartments);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteCourse(id: string) {
    if (!confirm("Delete this course? Teachers with an assignment for it will keep it, but new assignments can't reference it.")) return;
    await fetch(`/api/institution/courses/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Courses</h2>
          <p className="text-gray-500 text-sm">Catalog teachers pick from when registering what they teach</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Course
        </button>
      </div>

      <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No courses yet. Add your first course to get started.</div>
        ) : (
          <div className="divide-y divide-indigo-50">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.department.name}</p>
                </div>
                <button onClick={() => deleteCourse(c.id)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddCourseModal departments={departments} onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  );
}

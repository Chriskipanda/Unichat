"use client";

import { useEffect, useState } from "react";

interface Teacher {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
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
  teacher: Teacher;
  course: { id: string; name: string; department: { id: string; name: string } };
  cr: Cr | null;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/assignments");
    const data = await res.json();
    setAssignments(data.assignments ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function removeCr(id: string) {
    if (!confirm("Remove the Class Representative for this assignment?")) return;
    await fetch(`/api/institution/assignments/${id}/cr`, { method: "DELETE" });
    load();
  }

  async function removeAssignment(id: string) {
    if (!confirm("Remove this teaching assignment? The teacher will need to re-add it, and its Class Rep (if any) loses that role unless they hold another assignment.")) return;
    await fetch(`/api/institution/assignments/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = assignments.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.teacher.fullName.toLowerCase().includes(q) ||
      a.course.name.toLowerCase().includes(q) ||
      a.course.department.name.toLowerCase().includes(q) ||
      a.ntaLevel.toLowerCase().includes(q) ||
      a.cr?.fullName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Teaching Assignments</h2>
          <p className="text-gray-500 text-sm">Every teacher's registered course + NTA level, and who's Class Rep for it</p>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search teacher, course, department, level, or CR…"
        className="w-full max-w-md border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {assignments.length === 0
              ? "No teaching assignments yet — teachers register these from the Teacher Portal after logging in."
              : "No assignments match your search."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-indigo-50 border-b border-indigo-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Teacher</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Programme</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">NTA Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Class Rep</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-indigo-50/50 transition-colors align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.teacher.fullName}</p>
                    <p className="text-xs text-gray-400">{a.teacher.email || a.teacher.phone || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{a.course.name}</p>
                    <p className="text-xs text-gray-400">{a.course.department.name}</p>
                    <p className="text-xs text-gray-500 md:hidden mt-0.5">{a.ntaLevel}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{a.ntaLevel}</td>
                  <td className="px-4 py-3">
                    {a.cr ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          {a.cr.fullName}
                        </span>
                        <button
                          onClick={() => removeCr(a.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                          title="Remove Class Rep"
                        >
                          remove
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeAssignment(a.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove assignment"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

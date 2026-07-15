"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  studentId?: string;
  role: "student" | "teacher" | "staff" | "admin";
  isActive: boolean;
  createdAt: string;
}

const ROLE_TABS = ["all", "student", "teacher", "admin"] as const;
type RoleTab = typeof ROLE_TABS[number];

// Display label for a role value (handles legacy "staff" from DB)
function roleLabel(role: string) {
  if (role === "staff" || role === "teacher") return "Teacher";
  if (role === "admin") return "Admin";
  return "Student";
}

interface AddModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddModal({ onClose, onCreated }: AddModalProps) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    studentId: "",
    role: "student" as "student" | "teacher",
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
    if (!res.ok) { setError(data.error ?? "Failed to create user."); return; }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student / Staff ID</label>
            <input
              type="text"
              value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              placeholder="e.g. STU001 or TCH042"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "student" | "teacher" }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? "Creating…" : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ROLE_BADGE: Record<string, string> = {
  student: "bg-blue-100 text-blue-700",
  teacher: "bg-violet-100 text-violet-700",
  staff: "bg-violet-100 text-violet-700",
  admin: "bg-indigo-100 text-indigo-700",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<RoleTab>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(user: User) {
    await fetch(`/api/institution/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-gray-500 text-sm">{users.length} total</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-1 bg-white border border-indigo-100 rounded-lg p-1">
          {ROLE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-indigo-50"}`}
            >
              {t === "teacher" ? "Teachers" : t === "student" ? "Students" : t === "admin" ? "Admins" : "All"}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or ID…"
          className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-indigo-50 border-b border-indigo-100">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide hidden md:table-cell">Contact / ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-indigo-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.fullName}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {u.email || u.studentId || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
                    >
                      {u.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove user"
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

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </div>
  );
}

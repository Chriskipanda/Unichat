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

interface AddFacultyModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddFacultyModal({ onClose, onCreated }: AddFacultyModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "faculty", name }),
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
        <h3 className="text-lg font-bold text-gray-900 mb-4">Add Faculty / School</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Faculty name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddDeptModalProps {
  facultyId: string;
  facultyName: string;
  onClose: () => void;
  onCreated: () => void;
}

function AddDeptModal({ facultyId, facultyName, onClose, onCreated }: AddDeptModalProps) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "department", facultyId, name }),
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
        <h3 className="text-lg font-bold text-gray-900 mb-1">Add Department</h3>
        <p className="text-sm text-gray-500 mb-4">Under {facultyName}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Department name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface BulkImportResult {
  facultiesCreated: number;
  departmentsCreated: number;
  programmesCreated: number;
  programmesSkipped: number;
  errors: string[];
}

function BulkImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkImportResult | null>(null);

  async function handleImport() {
    const rows = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [faculty, department, programmes] = line.split("|").map((p) => p?.trim() ?? "");
        return { faculty, department, programmes };
      });

    if (rows.length === 0) {
      setError("Paste at least one row first.");
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch("/api/institution/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Import failed."); return; }
    setResult(data);
    onImported();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Bulk Import</h3>
        <p className="text-sm text-gray-500 mb-4">
          One row per line: <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Faculty | Department | Programme 1; Programme 2</code>.
          Existing faculties/departments/programmes are matched by name and skipped — safe to paste the same list twice.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={"Faculty of Computing and Information Technology | Department of Computer Science | Ordinary Diploma in Computer Science; Bachelor Degree in Computer Science\nFaculty of Computing and Information Technology | Department of Information Technology | Ordinary Diploma in Information Technology; Bachelor Degree in Information Technology"}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        {result && (
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm space-y-1">
            <p className="font-medium text-gray-900">Import complete</p>
            <p className="text-gray-600">Faculties created: {result.facultiesCreated}</p>
            <p className="text-gray-600">Departments created: {result.departmentsCreated}</p>
            <p className="text-gray-600">Programmes created: {result.programmesCreated} (skipped {result.programmesSkipped} already present)</p>
            {result.errors.length > 0 && (
              <div className="pt-2">
                <p className="text-red-600 font-medium">{result.errors.length} row(s) had problems:</p>
                <ul className="list-disc list-inside text-red-500 text-xs">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button type="button" onClick={handleImport} disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [addDeptFor, setAddDeptFor] = useState<Faculty | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/departments");
    const data = await res.json();
    setFaculties(data.faculties ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteFaculty(id: string) {
    if (!confirm("Delete this faculty and all its departments?")) return;
    await fetch(`/api/institution/faculties/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteDept(id: string) {
    if (!confirm("Delete this department?")) return;
    await fetch(`/api/institution/departments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Departments</h2>
          <p className="text-gray-500 text-sm">Manage faculties and departments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="flex items-center gap-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M7 10l5 5 5-5M12 15V3" />
            </svg>
            Bulk Import
          </button>
          <button
            onClick={() => setShowAddFaculty(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Faculty
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : faculties.length === 0 ? (
        <div className="bg-white border border-indigo-100 rounded-xl p-12 text-center text-gray-400 text-sm">
          No faculties yet. Add your first faculty to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {faculties.map((faculty) => (
            <div key={faculty.id} className="bg-white border border-indigo-100 rounded-xl overflow-hidden">
              {/* Faculty header */}
              <div className="flex items-center justify-between px-5 py-4 bg-indigo-50 border-b border-indigo-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                  <span className="font-semibold text-gray-900">{faculty.name}</span>
                  <span className="text-xs text-indigo-400 ml-1">{faculty.departments.length} dept{faculty.departments.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAddDeptFor(faculty)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-100"
                  >
                    + Department
                  </button>
                  <button
                    onClick={() => deleteFaculty(faculty.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Departments */}
              {faculty.departments.length === 0 ? (
                <p className="text-sm text-gray-400 px-5 py-4">No departments yet.</p>
              ) : (
                <div className="divide-y divide-indigo-50">
                  {faculty.departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-300" />
                        <span className="text-sm text-gray-700">{dept.name}</span>
                      </div>
                      <button
                        onClick={() => deleteDept(dept.id)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddFaculty && <AddFacultyModal onClose={() => setShowAddFaculty(false)} onCreated={load} />}
      {addDeptFor && <AddDeptModal facultyId={addDeptFor.id} facultyName={addDeptFor.name} onClose={() => setAddDeptFor(null)} onCreated={load} />}
      {showBulkImport && <BulkImportModal onClose={() => setShowBulkImport(false)} onImported={load} />}
    </div>
  );
}

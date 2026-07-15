"use client";

import { useEffect, useState } from "react";

interface Club {
  id: string;
  name: string;
  description?: string;
  category?: string;
  isActive: boolean;
  memberCount?: number;
}

interface ClubModalProps {
  club?: Club;
  onClose: () => void;
  onSaved: () => void;
}

function ClubModal({ club, onClose, onSaved }: ClubModalProps) {
  const isEdit = !!club;
  const [form, setForm] = useState({
    name: club?.name ?? "",
    description: club?.description ?? "",
    category: club?.category ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = isEdit
      ? await fetch(`/api/institution/clubs/${club!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/institution/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{isEdit ? "Edit Club" : "Add Club"}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Academic, Sports, Culture"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? "Saving…" : isEdit ? "Save" : "Add Club"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Academic: "bg-blue-100 text-blue-700",
  Sports: "bg-green-100 text-green-700",
  Culture: "bg-amber-100 text-amber-700",
  Technology: "bg-purple-100 text-purple-700",
  Arts: "bg-pink-100 text-pink-700",
};

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Club | undefined>(undefined);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/institution/clubs");
    const data = await res.json();
    setClubs(data.clubs ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(club: Club) {
    await fetch(`/api/institution/clubs/${club.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !club.isActive }),
    });
    load();
  }

  async function deleteClub(id: string) {
    if (!confirm("Delete this club?")) return;
    await fetch(`/api/institution/clubs/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Clubs</h2>
          <p className="text-gray-500 text-sm">{clubs.length} registered</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Club
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clubs.length === 0 ? (
        <div className="bg-white border border-indigo-100 rounded-xl p-12 text-center text-gray-400 text-sm">
          No clubs yet. Create your first student club.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <div
              key={club.id}
              className={`bg-white border rounded-xl p-5 flex flex-col gap-3 transition-all ${club.isActive ? "border-indigo-100" : "border-gray-100 opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900 leading-tight">{club.name}</h3>
                {club.category && (
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[club.category] ?? "bg-indigo-100 text-indigo-700"}`}>
                    {club.category}
                  </span>
                )}
              </div>
              {club.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{club.description}</p>
              )}
              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                <button
                  onClick={() => toggleActive(club)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${club.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {club.isActive ? "Active" : "Inactive"}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => { setEditing(club); setShowModal(true); }}
                  className="text-indigo-400 hover:text-indigo-600 p-1 rounded"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteClub(club.id)}
                  className="text-gray-400 hover:text-red-500 p-1 rounded"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ClubModal
          club={editing}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          onSaved={load}
        />
      )}
    </div>
  );
}

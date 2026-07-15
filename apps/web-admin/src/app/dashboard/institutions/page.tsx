"use client";
import { useEffect, useState } from "react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  status: string;
  maxUsers: number;
  _count: { users: number };
  createdAt: string;
};

const PLANS = ["starter", "growth", "enterprise"];
const PLAN_STYLES: Record<string, string> = {
  starter: "bg-green-100 text-green-700 border border-green-200",
  growth: "bg-green-200 text-green-800 border border-green-300",
  enterprise: "bg-green-700 text-white border border-green-700",
};
const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
  inactive: "bg-gray-100 text-gray-600",
};

export default function InstitutionsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = async (t: Tenant) => {
    const next = t.status === "active" ? "inactive" : "active";
    await fetch(`/api/tenants/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  };

  const changePlan = async (id: string, plan: string) => {
    await fetch(`/api/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    load();
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-green-950 font-bold text-xl">Institutions</h2>
          <p className="text-green-500 text-sm mt-0.5">
            {tenants.length} institution{tenants.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Institution
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug..."
          className="w-full max-w-sm pl-10 pr-4 py-2.5 rounded-xl border border-green-200 bg-white text-green-950 placeholder-green-300 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-50 text-green-700 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Institution</th>
                  <th className="px-5 py-3 text-left">Slug</th>
                  <th className="px-5 py-3 text-left">Domain</th>
                  <th className="px-5 py-3 text-left">Plan</th>
                  <th className="px-5 py-3 text-left">Users / Max</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-green-400 text-sm">
                      {search ? "No institutions match your search." : "No institutions yet."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-green-50/40 transition-colors">
                      <td className="px-5 py-4 font-semibold text-green-900">{t.name}</td>
                      <td className="px-5 py-4 font-mono text-green-600 text-xs">{t.slug}</td>
                      <td className="px-5 py-4 text-green-600 text-xs">{t.domain ?? "—"}</td>
                      <td className="px-5 py-4">
                        <select
                          value={t.plan}
                          onChange={(e) => changePlan(t.id, e.target.value)}
                          className="text-xs font-semibold rounded-full px-2.5 py-1 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-400 capitalize"
                          style={{ background: "transparent" }}
                        >
                          {PLANS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-green-700">
                        <span className="font-semibold">{t._count?.users ?? 0}</span>
                        <span className="text-green-400"> / {t.maxUsers}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[t.status] ?? STATUS_STYLES.inactive}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleStatus(t)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                            t.status === "active"
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {t.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Institution Modal */}
      {showModal && <AddModal onClose={() => setShowModal(false)} onSuccess={load} />}
    </div>
  );
}

function AddModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", domain: "", plan: "starter", maxUsers: "500" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        domain: form.domain || undefined,
        plan: form.plan,
        maxUsers: parseInt(form.maxUsers, 10),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to create institution"); return; }
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-green-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-green-100 w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-green-950 font-bold text-lg">Add Institution</h3>
            <p className="text-green-500 text-xs mt-0.5">Register a new university or college</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-green-400 hover:bg-green-100 hover:text-green-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Institution Name", key: "name", placeholder: "Arusha Technical College", required: true },
            { label: "Slug", key: "slug", placeholder: "atc", required: true },
            { label: "Domain (optional)", key: "domain", placeholder: "atc.ac.tz", required: false },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-green-800 mb-1">{f.label}</label>
              <input
                type="text"
                value={(form as any)[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                className="w-full px-3.5 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-950 placeholder-green-300 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-green-800 mb-1">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => set("plan", e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-950 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition capitalize"
              >
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-green-800 mb-1">Max Users</label>
              <input
                type="number"
                value={form.maxUsers}
                onChange={(e) => set("maxUsers", e.target.value)}
                min="10"
                max="100000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-950 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-green-200 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white text-sm font-semibold transition-colors"
            >
              {loading ? "Creating..." : "Create Institution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

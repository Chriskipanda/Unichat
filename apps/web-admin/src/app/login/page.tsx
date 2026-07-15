"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left: brand panel ─────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-950 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute top-1/4 -left-16 w-80 h-80 rounded-full bg-green-700 opacity-20 blur-3xl" />
        <div className="absolute bottom-1/4 -right-16 w-96 h-96 rounded-full bg-green-600 opacity-15 blur-3xl" />
        <div className="absolute top-3/4 left-1/4 w-48 h-48 rounded-full bg-green-400 opacity-10 blur-2xl" />

        <div className="relative z-10 text-center max-w-sm">
          {/* Logo mark */}
          <div className="w-20 h-20 rounded-3xl bg-green-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-green-900/60">
            <svg viewBox="0 0 24 24" className="w-11 h-11 text-white" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>

          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">UniChat</h1>
          <p className="text-green-400 font-semibold text-lg mb-1">Enterprise Platform</p>
          <p className="text-green-600 text-sm mb-10">SuperAdmin Console</p>

          <div className="space-y-3 text-left">
            {[
              { label: "Manage Institutions", desc: "Add and configure universities & colleges" },
              { label: "Control Plans & Billing", desc: "Set subscription tiers and feature limits" },
              { label: "Monitor the Platform", desc: "Real-time usage stats and health signals" },
            ].map((item) => (
              <div key={item.label} className="flex gap-3 bg-green-900/50 border border-green-800 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-green-100 text-sm font-semibold">{item.label}</p>
                  <p className="text-green-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="absolute bottom-6 text-green-700 text-xs">
          UniChat Enterprise · Platform Edition
        </p>
      </div>

      {/* ── Right: login form ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-green-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-green-700 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-white" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-8">
            {/* Shield icon + heading */}
            <div className="mb-8">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-5">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-950">Admin Sign In</h2>
              <p className="text-green-600 text-sm mt-1">Access restricted to platform administrators</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-green-800 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="superadmin@unichat.io"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-green-950 placeholder-green-300 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-green-800 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-green-200 bg-green-50 text-green-950 placeholder-green-300 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in to Console"
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-green-100 text-center">
              <p className="text-xs text-green-400">
                UniChat Enterprise &middot; SuperAdmin access only
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

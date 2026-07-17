"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Institution {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

export default function TeacherLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/institutions")
      .then((r) => r.json())
      .then((d) => setInstitutions(d.institutions ?? []));
  }, []);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInstitution) {
      setError("Please select an institution.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/teacher/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: selectedInstitution.slug, identifier }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to send OTP.");
      return;
    }
    setStep(2);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/teacher/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: selectedInstitution!.slug, identifier, otp }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Invalid OTP.");
      return;
    }
    router.push("/teacher");
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-950 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 12.5v3.5m-9-4.5v9.5m0 0l-6.16-3.422A12.083 12.083 0 013 12.5v-3.5" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg">UniChat</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Teacher<br />Portal
          </h1>
          <p className="text-emerald-300 mt-4 text-lg">
            Register the course &amp; NTA level you teach, and assign a Class Representative.
          </p>
        </div>

        <div className="flex items-center gap-4 text-emerald-400 text-sm">
          <span>Secure OTP login</span>
          <span>·</span>
          <span>Tenant-scoped access</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-emerald-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <span className="font-semibold text-lg text-emerald-950">UniChat</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 1 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-400"}`}>1</div>
              <div className={`flex-1 h-0.5 ${step >= 2 ? "bg-emerald-600" : "bg-emerald-100"}`} />
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 2 ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-400"}`}>2</div>
            </div>

            {step === 1 ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
                <p className="text-gray-500 text-sm mt-1 mb-6">Select your institution and enter your email or phone.</p>

                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
                    <select
                      value={selectedInstitution?.id ?? ""}
                      onChange={(e) => {
                        const inst = institutions.find((i) => i.id === e.target.value) ?? null;
                        setSelectedInstitution(inst);
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      required
                    >
                      <option value="">Select institution…</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email or Phone</label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="teacher@institution.edu"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {error && <p className="text-red-600 text-sm">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
                  >
                    {loading ? "Sending OTP…" : "Send OTP"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900">Enter OTP</h2>
                <p className="text-gray-500 text-sm mt-1 mb-6">
                  Check the code sent to{" "}
                  <span className="font-medium text-gray-700">{identifier}</span>.
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">One-Time Password</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      maxLength={6}
                      required
                    />
                  </div>

                  {error && <p className="text-red-600 text-sm">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
                  >
                    {loading ? "Verifying…" : "Sign in"}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep(1); setOtp(""); setError(""); }}
                    className="w-full text-emerald-600 hover:text-emerald-800 text-sm font-medium py-1"
                  >
                    ← Back
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-emerald-400 text-xs mt-6">
            Institution Admin?{" "}
            <a href="/admin-login" className="text-emerald-600 hover:underline font-medium">Sign in here</a>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, AlertCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { StepIndicator } from "@/components/auth/StepIndicator";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ACCENT = "var(--color-auth-admin)";
const ACCENT_DARK = "var(--color-auth-admin-dark)";
const RESEND_COOLDOWN_SECONDS = 30;

interface Institution {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const identifierId = useId();
  const errorId = useId();

  const [step, setStep] = useState<1 | 2>(1);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/institutions")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setInstitutions(d.institutions ?? []);
        setInstitutionsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setInstitutionsError("Couldn't load institutions. Refresh to try again.");
        setInstitutionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function requestOtp() {
    if (!selectedInstitution) {
      setError("Please select an institution.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/institution/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: selectedInstitution.slug, identifier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send OTP.");
        return;
      }
      setStep(2);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    await requestOtp();
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    await requestOtp();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/institution/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: selectedInstitution!.slug, identifier, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid OTP.");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      accent={ACCENT}
      accentDark={ACCENT_DARK}
      eyebrow="Institution Console"
      headline={
        <>
          Institution
          <br />
          Admin Portal
        </>
      }
      tagline="Manage your institution's users, departments, clubs, and branding — all in one place."
      features={["Secure OTP login", "Tenant-scoped access", "Role-protected"]}
      footer={
        <p className="text-muted-foreground text-xs">
          SuperAdmin?{" "}
          <a href="/login" className="font-medium hover:underline" style={{ color: ACCENT }}>
            Sign in here
          </a>
          {" · "}
          Teacher?{" "}
          <a href="/teacher-login" className="font-medium hover:underline" style={{ color: ACCENT }}>
            Sign in here
          </a>
        </p>
      }
    >
      <StepIndicator step={step} total={2} accent={ACCENT} />

      {step === 1 ? (
        <div key="step-1" className="animate-fade-up">
          <h2 className="text-heading">Sign in</h2>
          <p className="text-subtitle mt-1 mb-6">Select your institution and enter your email or phone.</p>

          <form onSubmit={handleRequestOtp} className="space-y-4" noValidate>
            <div>
              <Label className="mb-1.5">Institution</Label>
              <Select
                value={selectedInstitution?.id ?? ""}
                onValueChange={(val) => {
                  const inst = institutions.find((i) => i.id === val) ?? null;
                  setSelectedInstitution(inst);
                }}
                disabled={institutionsLoading}
              >
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder={institutionsLoading ? "Loading institutions…" : "Select institution…"} />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {institutionsError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{institutionsError}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor={identifierId} className="mb-1.5">
                Email or Phone
              </Label>
              <Input
                ref={identifierRef}
                id={identifierId}
                className="h-11"
                type="text"
                inputMode="email"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@institution.edu"
                aria-describedby={error ? errorId : undefined}
                required
              />
            </div>

            {error && (
              <Alert id={errorId} variant="destructive" className="animate-fade-up">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11"
              style={{ backgroundColor: ACCENT }}
            >
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "Sending OTP…" : "Send OTP"}
            </Button>
          </form>
        </div>
      ) : (
        <div key="step-2" className="animate-fade-up">
          <h2 className="text-heading">Enter OTP</h2>
          <p className="text-subtitle mt-1 mb-6">
            Check your auth-service logs for the code sent to{" "}
            <span className="font-medium text-foreground">{identifier}</span>.
          </p>

          <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
            <div>
              <Label className="mb-1.5">One-Time Password</Label>
              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={loading}
                accent={ACCENT}
                errorId={error ? errorId : undefined}
              />
            </div>

            {error && (
              <Alert id={errorId} variant="destructive" className="animate-fade-up">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-11"
              style={{ backgroundColor: ACCENT }}
            >
              {loading && <Loader2 className="animate-spin" />}
              {loading ? "Verifying…" : "Sign in"}
            </Button>

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                }}
              >
                <ChevronLeft />
                Back
              </Button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-sm font-medium disabled:text-muted-foreground disabled:cursor-not-allowed hover:underline"
                style={{ color: resendCooldown > 0 || loading ? undefined : ACCENT }}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthShell>
  );
}

"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ACCENT = "var(--color-auth-super)";
const ACCENT_DARK = "var(--color-auth-super-dark)";

export default function LoginPage() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      accent={ACCENT}
      accentDark={ACCENT_DARK}
      eyebrow="Platform Console"
      headline={
        <>
          UniChat
          <br />
          Enterprise
        </>
      }
      tagline="Manage institutions, plans, billing, and platform-wide health from a single console."
      features={["Manage institutions", "Control plans & billing", "Monitor the platform"]}
      footer={
        <p className="text-muted-foreground text-xs">UniChat Enterprise · SuperAdmin access only</p>
      }
    >
      <div className="mb-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
          style={{ backgroundColor: "var(--color-auth-super-tint)" }}
        >
          <ShieldCheck className="w-5.5 h-5.5" style={{ color: ACCENT }} />
        </div>
        <h2 className="text-heading">Admin sign in</h2>
        <p className="text-subtitle mt-1">Access restricted to platform administrators.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor={emailId} className="mb-1.5">
            Email address
          </Label>
          <Input
            id={emailId}
            className="h-11"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="superadmin@unichat.io"
            required
          />
        </div>

        <div>
          <Label htmlFor={passwordId} className="mb-1.5">
            Password
          </Label>
          <div className="relative">
            <Input
              id={passwordId}
              className="h-11 pr-10"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              aria-describedby={error ? errorId : undefined}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-0 top-0 h-11 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <Alert id={errorId} variant="destructive" className="animate-fade-up">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={loading} className="w-full h-11" style={{ backgroundColor: ACCENT }}>
          {loading && <Loader2 className="animate-spin" />}
          {loading ? "Signing in…" : "Sign in to console"}
        </Button>
      </form>
    </AuthShell>
  );
}

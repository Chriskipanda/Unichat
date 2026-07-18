"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const ACCENT = "var(--color-auth-super)";

interface PlatformSettings {
  name: string;
  supportEmail: string;
  maxTenantsDefault: string;
  selfRegistration: boolean;
  publicTenantList: boolean;
  requireOtp: boolean;
  maintenanceMode: boolean;
  analyticsTracking: boolean;
  emailNotifications: boolean;
}

const DEFAULTS: PlatformSettings = {
  name: "UniChat Enterprise",
  supportEmail: "support@unichat.io",
  maxTenantsDefault: "100",
  selfRegistration: false,
  publicTenantList: true,
  requireOtp: true,
  maintenanceMode: false,
  analyticsTracking: true,
  emailNotifications: true,
};

function SectionCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="p-0 overflow-hidden gap-0">
      <div className="px-6 py-4 border-b border-border bg-muted/30">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-metadata mt-0.5">{desc}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </Card>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-metadata mt-0.5">{desc}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setSettings({ ...DEFAULTS, ...d.settings });
      })
      .catch(() => setError("Failed to load settings."))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError("Failed to save settings.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-heading">Platform Settings</h2>
        <p className="text-subtitle mt-1">Global configuration for UniChat Enterprise</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive text-sm">{error}</div>
      )}

      <SectionCard title="Platform Identity" desc="Basic information about this UniChat deployment">
        {(
          [
            { label: "Platform Name", key: "name" as const, placeholder: "UniChat Enterprise" },
            { label: "Support Email", key: "supportEmail" as const, placeholder: "support@unichat.io" },
            { label: "Max Institutions (default)", key: "maxTenantsDefault" as const, placeholder: "100" },
          ] as const
        ).map((f) => (
          <div key={f.key}>
            <Label className="mb-1.5">{f.label}</Label>
            <Input value={settings[f.key] as string} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} />
          </div>
        ))}
      </SectionCard>

      <SectionCard title="Feature Flags" desc="Global defaults applied to all new institutions">
        <Toggle
          label="OTP Authentication Required"
          desc="New institutions must enforce OTP login for all users"
          value={settings.requireOtp}
          onChange={(v) => set("requireOtp", v)}
        />
        <div className="border-t border-border" />
        <Toggle
          label="Public Institution List"
          desc="The mobile app TenantScreen shows all active institutions"
          value={settings.publicTenantList}
          onChange={(v) => set("publicTenantList", v)}
        />
        <div className="border-t border-border" />
        <Toggle
          label="Allow Self-Registration"
          desc="Students can register without admin pre-approval"
          value={settings.selfRegistration}
          onChange={(v) => set("selfRegistration", v)}
        />
        <div className="border-t border-border" />
        <Toggle
          label="Email Notifications"
          desc="Send platform alerts to institution admins via email"
          value={settings.emailNotifications}
          onChange={(v) => set("emailNotifications", v)}
        />
        <div className="border-t border-border" />
        <Toggle
          label="Analytics Tracking"
          desc="Collect aggregated usage data across the platform"
          value={settings.analyticsTracking}
          onChange={(v) => set("analyticsTracking", v)}
        />
      </SectionCard>

      <SectionCard title="Maintenance Mode" desc="Temporarily disable access for all non-admin users">
        <Toggle
          label="Maintenance Mode"
          desc="When enabled, students and staff see a maintenance screen"
          value={settings.maintenanceMode}
          onChange={(v) => set("maintenanceMode", v)}
        />
        {settings.maintenanceMode && (
          <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-destructive text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Maintenance mode is ON — all student and staff sessions are blocked
          </div>
        )}
      </SectionCard>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: ACCENT }}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        {saved && (
          <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: ACCENT }}>
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

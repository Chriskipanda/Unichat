"use client";
import { useState, useEffect } from "react";

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
    <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-green-100 bg-green-50">
        <h3 className="text-green-900 font-semibold text-sm">{title}</h3>
        <p className="text-green-500 text-xs mt-0.5">{desc}</p>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-green-900 text-sm font-medium">{label}</p>
        <p className="text-green-400 text-xs mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${value ? "bg-green-600" : "bg-green-200"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
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

  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

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
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-green-950 font-bold text-xl">Platform Settings</h2>
        <p className="text-green-500 text-sm mt-1">Global configuration for UniChat Enterprise</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Platform info */}
      <SectionCard title="Platform Identity" desc="Basic information about this UniChat deployment">
        {(
          [
            { label: "Platform Name", key: "name" as const, placeholder: "UniChat Enterprise" },
            { label: "Support Email", key: "supportEmail" as const, placeholder: "support@unichat.io" },
            { label: "Max Institutions (default)", key: "maxTenantsDefault" as const, placeholder: "100" },
          ] as const
        ).map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-semibold text-green-800 mb-1.5">{f.label}</label>
            <input
              type="text"
              value={settings[f.key] as string}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3.5 py-2.5 rounded-xl border border-green-200 bg-green-50 text-green-950 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200 transition"
            />
          </div>
        ))}
      </SectionCard>

      {/* Feature flags */}
      <SectionCard title="Feature Flags" desc="Global defaults applied to all new institutions">
        <Toggle
          label="OTP Authentication Required"
          desc="New institutions must enforce OTP login for all users"
          value={settings.requireOtp}
          onChange={(v) => set("requireOtp", v)}
        />
        <div className="border-t border-green-100" />
        <Toggle
          label="Public Institution List"
          desc="The mobile app TenantScreen shows all active institutions"
          value={settings.publicTenantList}
          onChange={(v) => set("publicTenantList", v)}
        />
        <div className="border-t border-green-100" />
        <Toggle
          label="Allow Self-Registration"
          desc="Students can register without admin pre-approval"
          value={settings.selfRegistration}
          onChange={(v) => set("selfRegistration", v)}
        />
        <div className="border-t border-green-100" />
        <Toggle
          label="Email Notifications"
          desc="Send platform alerts to institution admins via email"
          value={settings.emailNotifications}
          onChange={(v) => set("emailNotifications", v)}
        />
        <div className="border-t border-green-100" />
        <Toggle
          label="Analytics Tracking"
          desc="Collect aggregated usage data across the platform"
          value={settings.analyticsTracking}
          onChange={(v) => set("analyticsTracking", v)}
        />
      </SectionCard>

      {/* Maintenance mode */}
      <SectionCard title="Maintenance Mode" desc="Temporarily disable access for all non-admin users">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-900 text-sm font-medium">Maintenance Mode</p>
            <p className="text-green-400 text-xs mt-0.5">
              When enabled, students and staff see a maintenance screen
            </p>
          </div>
          <button
            onClick={() => set("maintenanceMode", !settings.maintenanceMode)}
            className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${settings.maintenanceMode ? "bg-red-500" : "bg-green-200"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.maintenanceMode ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
        {settings.maintenanceMode && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-xs font-medium">
            Maintenance mode is ON — all student and staff sessions are blocked
          </div>
        )}
      </SectionCard>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-60"
        >
          {saving && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

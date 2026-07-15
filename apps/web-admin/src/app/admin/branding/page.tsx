"use client";

import { useEffect, useRef, useState } from "react";

interface Branding {
  primaryColor: string;
  accentColor: string;
  logoUrl: string;
  fontFamily: string;
}

const FONT_OPTIONS = ["Inter", "Roboto", "Poppins", "Lato", "Open Sans", "Nunito", "Montserrat"];

export default function BrandingPage() {
  const [branding, setBranding] = useState<Branding>({
    primaryColor: "#4f46e5",
    accentColor: "#818cf8",
    logoUrl: "",
    fontFamily: "Inter",
  });
  const [preview, setPreview] = useState<string | null>(null); // local object URL
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/institution/branding")
      .then((r) => r.json())
      .then((d) => {
        if (d.branding) setBranding((b) => ({ ...b, ...d.branding }));
        if (d.logoUrl) setBranding((b) => ({ ...b, logoUrl: d.logoUrl }));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Only PNG, JPEG or WebP images accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Logo must be under 2 MB.");
      return;
    }

    setUploadError("");
    // Show instant local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // Upload
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/institution/logo", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);

    if (res.ok) {
      setBranding((b) => ({ ...b, logoUrl: data.url }));
    } else {
      setUploadError(data.error ?? "Upload failed.");
      setPreview(null);
    }

    // Reset input so same file can be re-selected after removal
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeLogo() {
    setPreview(null);
    setBranding((b) => ({ ...b, logoUrl: "" }));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/institution/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branding, logoUrl: branding.logoUrl }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const displayLogo = preview || branding.logoUrl || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Branding</h2>
        <p className="text-gray-500 text-sm mt-1">Customise how your institution appears in UniChat.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-3 bg-white border border-indigo-100 rounded-xl p-6 space-y-5">

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Institution Logo</label>

            {displayLogo ? (
              <div className="flex items-center gap-4 mb-3">
                <div className="w-20 h-20 rounded-xl border border-indigo-100 bg-indigo-50 flex items-center justify-center overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayLogo}
                    alt="Logo preview"
                    className="w-full h-full object-contain p-1"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium block"
                  >
                    Replace logo
                  </button>
                  <button
                    type="button"
                    onClick={removeLogo}
                    disabled={uploading}
                    className="text-xs text-red-500 hover:text-red-700 font-medium block"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={`w-full flex flex-col items-center justify-center gap-2 h-28 border-2 border-dashed rounded-xl transition-colors ${
                  uploading
                    ? "border-indigo-300 bg-indigo-50 cursor-wait"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer"
                }`}
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-indigo-400">Uploading…</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-gray-400">
                      Click to upload logo &nbsp;·&nbsp; PNG, JPEG or WebP &nbsp;·&nbsp; max 2 MB
                    </span>
                  </>
                )}
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {uploadError && (
              <p className="text-red-500 text-xs mt-1.5">{uploadError}</p>
            )}
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={branding.accentColor}
                  onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Font */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
            <select
              value={branding.fontFamily}
              onChange={(e) => setBranding((b) => ({ ...b, fontFamily: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Branding"}
          </button>
        </form>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
          <div className="bg-white border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
            <div
              className="p-4 text-white"
              style={{ background: branding.primaryColor, fontFamily: branding.fontFamily }}
            >
              <div className="flex items-center gap-2 mb-4">
                {displayLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayLogo}
                    alt="logo"
                    className="w-7 h-7 rounded object-contain bg-white/10 p-0.5"
                  />
                ) : (
                  <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                    </svg>
                  </div>
                )}
                <span className="text-sm font-semibold opacity-90">My Institution</span>
              </div>
              {["Dashboard", "Users", "Clubs"].map((item) => (
                <div
                  key={item}
                  className="text-xs py-1.5 px-2 rounded mb-1 opacity-80"
                  style={{ background: item === "Dashboard" ? branding.accentColor : "transparent" }}
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="p-4" style={{ fontFamily: branding.fontFamily }}>
              <div className="h-2 rounded-full w-3/4 mb-2" style={{ background: branding.primaryColor, opacity: 0.2 }} />
              <div className="h-2 rounded-full w-1/2 mb-3" style={{ background: branding.primaryColor, opacity: 0.1 }} />
              <div
                className="text-xs text-white px-3 py-1.5 rounded-lg inline-block"
                style={{ background: branding.primaryColor }}
              >
                Action button
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

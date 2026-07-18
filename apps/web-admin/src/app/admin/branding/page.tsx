"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Only PNG, JPEG or WebP images accepted.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Logo must be under 2 MB.");
      return;
    }

    setUploadError("");
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

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
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-heading">Branding</h2>
        <p className="text-subtitle mt-1">Customise how your institution appears in UniChat.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <Label className="mb-2">Institution Logo</Label>

              {displayLogo ? (
                <div className="flex items-center gap-4 mb-1">
                  <div className="w-20 h-20 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displayLogo} alt="Logo preview" className="w-full h-full object-contain p-1" />
                    {uploading && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="text-xs text-primary hover:underline font-medium block"
                    >
                      Replace logo
                    </button>
                    <button
                      type="button"
                      onClick={removeLogo}
                      disabled={uploading}
                      className="text-xs text-destructive hover:underline font-medium block"
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
                    uploading ? "border-primary/40 bg-primary/5 cursor-wait" : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <ImageUp className="w-7 h-7 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">Click to upload logo &nbsp;·&nbsp; PNG, JPEG or WebP &nbsp;·&nbsp; max 2 MB</span>
                    </>
                  )}
                </button>
              )}

              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />

              {uploadError && <p className="text-destructive text-xs mt-1.5">{uploadError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 shrink-0"
                  />
                  <Input
                    value={branding.primaryColor}
                    onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                    className="flex-1 font-mono"
                    maxLength={7}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding.accentColor}
                    onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 shrink-0"
                  />
                  <Input
                    value={branding.accentColor}
                    onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                    className="flex-1 font-mono"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-1.5">Font Family</Label>
              <Select value={branding.fontFamily} onValueChange={(v) => v && setBranding((b) => ({ ...b, fontFamily: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={saving || uploading}>
              {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Branding"}
            </Button>
          </form>
        </Card>


        <div className="lg:col-span-2">
          <p className="text-sm font-medium text-foreground mb-2">Preview</p>
          <Card className="p-0 overflow-hidden gap-0 shadow-soft-sm">
            <div className="p-4 text-white" style={{ background: branding.primaryColor, fontFamily: branding.fontFamily }}>
              <div className="flex items-center gap-2 mb-4">
                {displayLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={displayLogo} alt="logo" className="w-7 h-7 rounded object-contain bg-white/10 p-0.5" />
                ) : (
                  <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white/60" />
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
              <div className="text-xs text-white px-3 py-1.5 rounded-lg inline-block" style={{ background: branding.primaryColor }}>
                Action button
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

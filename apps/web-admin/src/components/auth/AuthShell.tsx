import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { LogoMark } from "./icons";

interface AuthShellProps {
  accent: string;
  accentDark: string;
  eyebrow: string;
  headline: ReactNode;
  tagline: string;
  features: string[];
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ accent, accentDark, eyebrow, headline, tagline, features, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex bg-muted/40">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(155deg, ${accentDark}, ${accent})` }}
      >
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "white" }}
          aria-hidden
        />
        <div
          className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10 blur-3xl"
          style={{ background: "white" }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 backdrop-blur rounded-lg flex items-center justify-center ring-1 ring-white/20">
            <LogoMark className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">UniChat</span>
        </div>

        <div className="relative">
          <span className="inline-block text-xs font-medium tracking-wide uppercase text-white/70 mb-3">
            {eyebrow}
          </span>
          <h1 className="text-display text-white leading-[1.15]">{headline}</h1>
          <p className="text-white/70 mt-4 text-base leading-relaxed max-w-sm">{tagline}</p>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 text-white/60 text-sm">
          {features.map((f, i) => (
            <span key={f} className="flex items-center gap-4">
              {i > 0 && (
                <span className="text-white/30" aria-hidden>
                  ·
                </span>
              )}
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
              <LogoMark className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-foreground">UniChat</span>
          </div>

          <Card className="shadow-soft-lg ring-1 ring-border p-8 gap-0">{children}</Card>

          {footer && <div className="text-center mt-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

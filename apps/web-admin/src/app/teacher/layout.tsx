"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { LogoMark } from "@/components/auth/icons";
import { Button } from "@/components/ui/button";

const ACCENT = "var(--color-auth-teacher)";
const ACCENT_DARK = "var(--color-auth-teacher-dark)";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/teacher/auth/logout", { method: "POST" });
    router.push("/teacher-login");
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header
        className="px-4 sm:px-6 py-3.5 flex items-center justify-between"
        style={{ background: `linear-gradient(155deg, ${ACCENT_DARK}, ${ACCENT})` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/15 backdrop-blur rounded-lg flex items-center justify-center shrink-0 ring-1 ring-white/20">
            <LogoMark className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-sm font-semibold">Teacher Portal</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-white/80 hover:text-white hover:bg-white/10"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </header>
      <main className="max-w-3xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}

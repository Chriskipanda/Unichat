"use client";

import { useRouter } from "next/navigation";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleSignOut() {
    await fetch("/api/teacher/auth/logout", { method: "POST" });
    router.push("/teacher-login");
  }

  return (
    <div className="min-h-screen bg-emerald-50">
      <header className="bg-emerald-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
            </svg>
          </div>
          <span className="text-white text-sm font-semibold">Teacher Portal</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-900 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </header>
      <main className="max-w-3xl mx-auto p-6">{children}</main>
    </div>
  );
}

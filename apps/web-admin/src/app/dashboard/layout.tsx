"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Building2,
  Wallet,
  Settings,
  LogOut,
  Menu,
  Sun,
  Moon,
  ChevronsUpDown,
} from "lucide-react";
import { LogoMark } from "@/components/auth/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ACCENT = "var(--color-auth-super)";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const nav: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/institutions", label: "Institutions", icon: Building2 },
  { href: "/dashboard/plans", label: "Plans", icon: Wallet },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function SidebarNav({ isActive, onNavigate }: { isActive: (href: string) => boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {nav.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              active
                ? { backgroundColor: ACCENT, color: "#ffffff" }
                : undefined
            }
          >
            <Icon
              className={`w-4.5 h-4.5 shrink-0 ${active ? "" : "text-sidebar-foreground/70"}`}
            />
            <span className={active ? "" : "text-sidebar-foreground/70"}>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));
  const activeLabel = nav.find((n) => isActive(n.href))?.label ?? "Dashboard";

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
            <LogoMark className="w-4 h-4 text-white" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sidebar-foreground text-sm font-semibold truncate">UniChat</p>
            <p className="text-sidebar-foreground/50 text-xs">Platform Console</p>
          </div>
        </div>

        <SidebarNav isActive={isActive} />

        <div className="px-3 pb-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-sidebar-border">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: ACCENT }}>
              <LogoMark className="w-4 h-4 text-white" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sidebar-foreground text-sm font-semibold truncate">UniChat</p>
              <p className="text-sidebar-foreground/50 text-xs">Platform Console</p>
            </div>
          </div>
          <SidebarNav isActive={isActive} onNavigate={() => setMobileOpen(false)} />
          <div className="px-3 pb-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <LogOut className="w-4.5 h-4.5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-header border-b border-border px-4 sm:px-6 py-3.5 flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </Button>

          <h1 className="text-title flex-1">{activeLabel}</h1>

          <div
            className="hidden sm:flex items-center gap-2 rounded-full px-3.5 py-1.5 border"
            style={{ backgroundColor: `${ACCENT}1a`, borderColor: `${ACCENT}33` }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
            <span className="text-xs font-semibold" style={{ color: ACCENT }}>
              Platform Online
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-muted transition-colors">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}>
                      SA
                    </AvatarFallback>
                  </Avatar>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
                </button>
              }
            />
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-1.5 py-1.5">
                <p className="text-sm font-medium truncate">UniChat Enterprise</p>
                <p className="text-xs text-muted-foreground">Platform SuperAdmin</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} variant="destructive">
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

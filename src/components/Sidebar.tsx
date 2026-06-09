"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, PlusCircle, Sliders, Calendar, FileText, History, Map, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { ThemeToggle } from "./ThemeToggle";
import { SchedulingSettings } from "./SchedulingSettings";
import { logout } from "@/app/login/actions";

const mainNav = [
  { name: "Calendar", href: "/", icon: Calendar },
  { name: "Planner", href: "/planner", icon: Map },
  { name: "Import Leads", href: "/leads/import", icon: PlusCircle },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Archive", href: "/archive", icon: History },
];

const settingsNav = [
  { name: "Email Templates", href: "/settings/email-copy", icon: FileText },
];



function Logo() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-40 bg-[var(--border)]/10 animate-pulse rounded" />;
  }

  const logo = resolvedTheme === "dark" ? "/trickery-logo-dark.svg" : "/trickery-logo-light.svg";

  return (
    <Link href="/" className="block group">
      <img 
        src={logo} 
        alt="Trickery Logo" 
        className="h-10 w-auto transition-transform duration-500 group-hover:scale-105" 
      />
    </Link>
  );
}




export default function Sidebar() {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-full w-64 flex-col bg-gradient-to-b from-[var(--surface)] to-[var(--background)] border-r border-[var(--border)] relative overflow-hidden">
      {/* Decorative Gradient Glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 blur-[100px] pointer-events-none" />

      
      <div className="flex h-20 items-center px-6 relative z-10">

        <Logo />
      </div>
      <nav className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = item.href === "/" 
              ? pathname === "/" 
              : item.href === "/leads"
                ? pathname === "/leads"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all",
                  isActive
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm border border-[var(--border)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/50"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                    isActive ? "text-[var(--accent)]" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Settings Navigation */}
        <div className="space-y-1">
          <p className="px-3 mb-2 text-[9px] font-black uppercase tracking-widest text-[var(--muted)]/50">Settings</p>
          {settingsNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all",
                  isActive
                    ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm border border-[var(--border)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]/50"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                    isActive ? "text-[var(--accent)]" : "text-[var(--muted)] group-hover:text-[var(--foreground)]"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 mt-auto flex items-center justify-between border-t border-[var(--border)]">
        <ThemeToggle />
        <div className="flex items-center space-x-1">
          <form action={logout}>
            <button 
              type="submit"
              className="p-2 hover:bg-red-500/10 rounded-full text-[var(--muted)] hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-[var(--background)] rounded-full text-[var(--muted)] hover:text-[var(--foreground)] transition-all border border-transparent hover:border-[var(--border)]"
            title="Settings"
          >
            <Sliders className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings && <SchedulingSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

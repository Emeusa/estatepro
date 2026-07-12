"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { supabase } from "@/lib/supabase/client";

type AdminNavKey = "dashboard" | "agents" | "reports" | "profile";

type AdminShellProps = {
  active: AdminNavKey;
  adminName: string;
  adminEmail: string;
  children: ReactNode;
};

type AdminStatCardProps = {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "amber";
};

const navItems: Array<{ key: AdminNavKey; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: "/admin" },
  { key: "agents", label: "Agents", href: "/admin/agents" },
  { key: "reports", label: "Reports", href: "/admin/reports" },
  { key: "profile", label: "Profile", href: "/admin#profile" }
];

export function adminInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD"
  );
}

export function AdminStatCard({ label, value, tone = "blue" }: AdminStatCardProps) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-blue-50 text-blue-700";

  return (
    <div className="rounded-xl border border-slate-300/80 bg-slate-200 p-3 shadow-sm sm:rounded-2xl sm:p-5">
      <div className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg sm:mb-5 sm:h-10 sm:w-10 sm:rounded-xl ${toneClass}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-current" />
      </div>
      <p className="text-2xl font-bold leading-none text-slate-950 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500 sm:mt-2 sm:text-sm">{label}</p>
    </div>
  );
}

export function AdminIdentityCard({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  return (
    <div className="hidden items-center gap-3 rounded-2xl bg-slate-200 p-3 shadow-sm lg:flex">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
        {adminInitials(adminName)}
      </span>
      <div className="min-w-0">
        <p className="max-w-56 truncate text-sm font-semibold text-slate-950">{adminName}</p>
        <p className="mt-0.5 max-w-56 truncate text-xs text-slate-500">{adminEmail}</p>
      </div>
    </div>
  );
}

export function statusPillClass(tone: "green" | "amber" | "red" | "slate") {
  if (tone === "green") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (tone === "amber") {
    return "bg-amber-100 text-amber-700";
  }
  if (tone === "red") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-600";
}

export function AdminShell({ active, adminName, adminEmail, children }: AdminShellProps) {
  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4]">
      <div className="grid min-h-screen lg:grid-cols-[206px_1fr]">
        <aside className="hidden border-r border-slate-400/70 bg-slate-200 lg:flex lg:flex-col">
          <div className="px-4 py-5">
            <p className="text-lg font-black tracking-tight text-[#430078]">C59 Estatehub</p>
          </div>
          <nav className="flex-1 space-y-2 px-3 py-3 text-sm text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex rounded-xl px-3 py-3 font-medium transition ${
                  active === item.key ? "bg-blue-50 text-blue-700" : "hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-300 p-3">
            <div className="flex items-center justify-center rounded-2xl bg-slate-300/70 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {adminInitials(adminName)}
              </span>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-slate-400/70 bg-slate-200 px-3 py-3 sm:px-4 lg:px-6">
            <div className="space-y-3 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {adminInitials(adminName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{adminName}</p>
                    <p className="truncate text-xs text-slate-500">{adminEmail}</p>
                  </div>
                </div>
                <button className="shrink-0 text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={logout}>
                  Log out
                </button>
              </div>
              <nav className="flex gap-2 overflow-x-auto text-xs font-bold text-slate-600">
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`shrink-0 rounded-full px-3 py-2 ${
                      active === item.key ? "bg-blue-100 text-blue-700" : "bg-slate-300"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="hidden items-center justify-end lg:flex">
              <button className="text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={logout}>
                Log out
              </button>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

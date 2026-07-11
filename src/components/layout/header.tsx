"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

type SessionUser = {
  role: "agent" | "client" | "admin";
} | null;

const marketLinks = [
  { label: "BUY", href: "/?listingCategory=for_sale#search-results" },
  { label: "RENT", href: "/?listingCategory=for_rent#search-results" },
  { label: "SHORT LET", href: "/?listingCategory=short_let#search-results" },
  { label: "LAND", href: "/?propertyType=land#search-results" }
];

const agentDashboardLinks = [
  { label: "Dashboard", href: "/agents/dashboard#dashboard" },
  { label: "My Listings", href: "/agents/listings" },
  { label: "Saved Listings", href: "/saved-listings" },
  { label: "Subscription", href: "/agents/dashboard#subscription" },
  { label: "My Profile", href: "/agents/profile" }
];

export function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAgentDashboard = pathname === "/agents/dashboard" || pathname === "/agents/listings" || pathname === "/agents/profile";

  useEffect(() => {
    let active = true;

    async function syncUser() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await apiRequest<{ user: SessionUser }>("/api/auth/me", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (active) {
          setUser(response.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    syncUser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      syncUser();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const dashboardHref =
    user?.role === "agent" ? "/agents/dashboard" : user?.role === "admin" ? "/admin" : "/dashboard";
  const dashboardLabel = user?.role === "client" ? "Profile" : "Dashboard";

  return (
    <header className="site-header border-b border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-0.5 sm:gap-4 lg:py-0">
        <Link href="/" className="brand-logo" aria-label="C59 Estatehub home">
          <Image
            src="/platform-logo-transparent.png"
            alt="C59 Estatehub"
            width={300}
            height={88}
            priority
            className="w-[160px] sm:w-[205px] lg:w-[245px]"
          />
        </Link>
        <nav className="flex items-center gap-2 text-sm text-white/92 sm:gap-3">
          {!isAgentDashboard ? (
            <>
              <div className="hidden items-center gap-5 lg:flex">
                {marketLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="market-link group relative"
                  >
                    {link.label}
                    <span className="absolute -bottom-1 left-0 h-[2px] w-0 rounded-full bg-amber-200 transition-all group-hover:w-full" />
                  </Link>
                ))}
              </div>
              {loading ? (
                <span className="nav-chip nav-chip-strong hidden sm:inline-flex">...</span>
              ) : user ? (
                <Link href={dashboardHref} className="nav-chip nav-chip-accent hidden sm:inline-flex">
                  <span className="sm:hidden">Profile</span>
                  <span className="hidden sm:inline">
                    {dashboardLabel}
                  </span>
                </Link>
              ) : (
                <>
                  <Link href="/login" className="nav-chip nav-chip-strong hidden sm:inline-flex">
                    <span className="sm:hidden">Login</span>
                    <span className="hidden sm:inline">Login</span>
                  </Link>
                  <Link href="/register" className="nav-chip nav-chip-accent hidden sm:inline-flex">
                    <span className="md:hidden">Sign Up</span>
                    <span className="hidden md:inline">Sign Up</span>
                  </Link>
                </>
              )}
            </>
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/16 sm:hidden"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((current) => !current)}
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            <span className="flex flex-col gap-1.5" aria-hidden="true">
              <span className={`h-0.5 w-5 rounded-full bg-current transition ${mobileOpen ? "translate-y-2 rotate-45" : ""}`} />
              <span className={`h-0.5 w-5 rounded-full bg-current transition ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`h-0.5 w-5 rounded-full bg-current transition ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`} />
            </span>
          </button>
        </nav>
      </div>
      {mobileOpen ? (
        <div className="border-t border-white/10 bg-[#0f877f]/95 px-4 pb-4 pt-3 text-white shadow-lg sm:hidden">
          {isAgentDashboard ? (
            <nav className="grid gap-1 text-sm font-black tracking-[0.08em]">
              {agentDashboardLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-2 py-3 transition hover:bg-white/10 hover:text-amber-200"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : (
            <>
              <nav className="grid gap-1 text-sm font-black tracking-[0.14em]">
                {marketLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-2 py-3 transition hover:bg-white/10 hover:text-amber-200"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 text-sm font-semibold">
                {loading ? (
                  <span className="rounded-xl px-2 py-3 text-white/70">Loading...</span>
                ) : user ? (
                  <Link
                    href={dashboardHref}
                    className="rounded-xl bg-amber-500 px-3 py-3 text-center text-white shadow-sm"
                    onClick={() => setMobileOpen(false)}
                  >
                    {dashboardLabel}
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-xl bg-white/10 px-3 py-3 text-center text-white transition hover:bg-white/16"
                      onClick={() => setMobileOpen(false)}
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-xl bg-amber-500 px-3 py-3 text-center text-white shadow-sm"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </header>
  );
}

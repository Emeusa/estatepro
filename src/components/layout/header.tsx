"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";

type SessionUser = {
  role: "agent" | "client" | "admin";
} | null;

export function Header() {
  const [user, setUser] = useState<SessionUser>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <header className="site-header border-b border-white/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-0.5 sm:gap-4 sm:py-1">
        <Link href="/" className="brand-logo" aria-label="EstateHub home">
          <Image
            src="/platform-logo.jpeg"
            alt="EstateHub platform logo"
            width={300}
            height={88}
            priority
            className="w-[170px] sm:w-[220px] lg:w-[280px]"
          />
        </Link>
        <nav className="flex items-center gap-2 text-sm text-white/92 sm:gap-3">
          <Link href="/" className="nav-chip hidden sm:inline-flex">
            Listings
          </Link>
          {loading ? (
            <span className="nav-chip nav-chip-strong">...</span>
          ) : user ? (
            <Link href={dashboardHref} className="nav-chip nav-chip-accent">
              <span className="sm:hidden">Profile</span>
              <span className="hidden sm:inline">
                {user.role === "client" ? "Profile" : "Dashboard"}
              </span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="nav-chip nav-chip-strong">
                <span className="sm:hidden">Login</span>
                <span className="hidden sm:inline">Login</span>
              </Link>
              <Link href="/register" className="nav-chip nav-chip-accent">
                <span className="md:hidden">Sign Up</span>
                <span className="hidden md:inline">Sign Up</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

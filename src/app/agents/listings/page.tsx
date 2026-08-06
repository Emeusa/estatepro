"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ListingManager } from "@/components/agents/listing-manager";
import { PaginationNav } from "@/components/listings/pagination-nav";
import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { apiRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase/client";
import { AgentEntitlements, ListingRecord, PaginationMetadata, UserRecord } from "@/lib/types";

type ListingsPageData = {
  user: UserRecord | null;
  profile: {
    agent?: {
      verificationStatus: string;
      isBlocked: boolean;
    };
  };
  listings: ListingRecord[];
  listingPagination: PaginationMetadata;
  entitlements?: AgentEntitlements;
  token: string;
};

const navItems = [
  { label: "Dashboard", href: "/agents/dashboard#dashboard" },
  { label: "My Listings", href: "/agents/listings" },
  { label: "Saved Listings", href: "/saved-listings" },
  { label: "Subscription", href: "/agents/subscription" },
  { label: "My Profile", href: "/agents/profile" }
];

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AG"
  );
}

function AgentListingsContent() {
  const searchParams = useSearchParams();
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const currentPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<ListingsPageData | null>(null);
  const [message, setMessage] = useState("Loading listings...");

  useEffect(() => {
    let active = true;

    async function loadListings() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Sign in first to access your listings.");
        }
        return;
      }

      try {
        const profile = await apiRequest<Omit<ListingsPageData, "token">>(`/api/agents/me?includeAnalytics=false&listPage=${currentPage}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (active) {
          setData({ ...profile, token: session.access_token });
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Failed to load listings.");
        }
      }
    }

    loadListings();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadListings();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [currentPage]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  if (!data) {
    return (
      <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    );
  }

  const agentName = data.user?.fullName ?? "Agent";
  const isVerified = data.profile.agent?.verificationStatus === "approved";

  function updateListings(listings: ListingRecord[]) {
    setData((current) => {
      if (!current) {
        return current;
      }
      const previousPageActiveCount = current.listings.filter(
        (listing) => listing.status === "active" && listing.availability === "available"
      ).length;
      const nextPageActiveCount = listings.filter(
        (listing) => listing.status === "active" && listing.availability === "available"
      ).length;
      return {
        ...current,
        listings,
        entitlements: current.entitlements
          ? {
              ...current.entitlements,
              activeListingCount: Math.max(
                0,
                current.entitlements.activeListingCount + nextPageActiveCount - previousPageActiveCount
              )
            }
          : current.entitlements
      };
    });
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
                key={item.href}
                href={item.href}
                className={`flex rounded-xl px-3 py-3 font-medium transition ${
                  item.href === "/agents/listings" ? "bg-blue-50 text-blue-700" : "hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-slate-300 p-3">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-300/70 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {initials(agentName)}
              </span>
              {isVerified ? (
                <VerifiedAgentName fullName="" isVerified className="[&>span:first-child]:hidden" />
              ) : null}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-slate-400/70 bg-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
            <div className="space-y-3 lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {initials(agentName)}
                  </span>
                  <div className="min-w-0">
                    <VerifiedAgentName
                      fullName={agentName}
                      isVerified={isVerified}
                      className="max-w-full truncate text-sm font-semibold text-slate-950"
                    />
                    <p className="truncate text-xs text-slate-500">{data.user?.email}</p>
                  </div>
                </div>
                <button
                  className="shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-300 transition hover:bg-white hover:text-slate-950"
                  onClick={logout}
                  type="button"
                >
                  Log out
                </button>
              </div>
            </div>
            <div className="hidden items-center justify-end lg:flex">
              <button className="text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={logout}>
                Log out
              </button>
            </div>
          </div>

          <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-5">
            <section className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">My listings</h1>
                <p className="mt-2 text-sm text-slate-500">Manage every property you have posted.</p>
              </div>
              <Link
                href="/agents/dashboard#listing-editor"
                className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
              >
                + Post a Property
              </Link>
            </section>

            <ListingManager
              token={data.token}
              initialListings={data.listings}
              entitlements={data.entitlements}
              listTitle="All listings"
              showForm={false}
              editHrefForListing={(listing) => `/agents/dashboard?editListing=${listing.id}#listing-editor`}
              onEntitlementsChanged={(entitlements) =>
                setData((current) => (current ? { ...current, entitlements } : current))
              }
              onListingsChanged={updateListings}
            />
            <PaginationNav
              {...data.listingPagination}
              basePath="/agents/listings"
              itemLabel="listings"
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AgentListingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading listings...</p>}>
      <AgentListingsContent />
    </Suspense>
  );
}

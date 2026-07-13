"use client";

import { FormEvent, useEffect, useState } from "react";

import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatPlanPrice, getPricingPlan } from "@/lib/pricing";
import { getEffectivePlanSlug } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase/client";
import { AgentProfile, SubscriptionRecord, UserRecord } from "@/lib/types";

type ProfileData = {
  user: UserRecord | null;
  profile: {
    agent?: {
      verificationStatus: string;
      businessName: string | null;
      trialEndsAt: string;
      isBlocked: boolean;
    };
    subscription?: SubscriptionRecord;
  };
  listings: unknown[];
};

const navItems = [
  { label: "Dashboard", href: "/agents/dashboard#dashboard" },
  { label: "My Listings", href: "/agents/listings" },
  { label: "Saved Listings", href: "/saved-listings" },
  { label: "Subscription", href: "/agents/subscription" },
  { label: "My Profile", href: "/agents/profile" }
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AG";
}

function DetailCard({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default function AgentProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [token, setToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading profile...");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Sign in first to access your profile.");
        }
        return;
      }

      try {
        const response = await apiRequest<ProfileData>("/api/agents/me", {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (active) {
          setData(response);
          setToken(session.access_token);
          setFullName(response.user?.fullName ?? "");
          setBusinessName(response.profile.agent?.businessName ?? "");
          setPhone(response.user?.phone ?? "");
          if (new URLSearchParams(window.location.search).get("edit") === "business") {
            setEditing(true);
          }
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not load profile.");
        }
      }
    }

    loadProfile();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setMessage("Your session expired. Sign in again.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await apiRequest<{ user: UserRecord; agent?: AgentProfile }>("/api/auth/me", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName,
          businessName,
          phone: phone.trim() || undefined
        })
      });
      setData((current) =>
        current
          ? {
              ...current,
              user: response.user,
              profile: {
                ...current.profile,
                agent: response.agent ?? current.profile.agent
              }
            }
          : current
      );
      setFullName(response.user.fullName);
      setBusinessName(response.agent?.businessName ?? "");
      setPhone(response.user.phone ?? "");
      setEditing(false);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!data?.user) {
    return (
      <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4] p-4">
        <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </div>
    );
  }

  const agentName = data.user.fullName;
  const publicDisplayName = data.profile.agent?.businessName || agentName;
  const verificationStatus = data.profile.agent?.verificationStatus ?? "pending";
  const isVerified = verificationStatus === "approved";
  const accountStatus = data.profile.agent?.isBlocked ? "Blocked" : "Operational";
  const currentPlan = getPricingPlan(getEffectivePlanSlug(data.profile.subscription));

  return (
    <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4]">
      <div className="grid min-h-screen lg:grid-cols-[206px_1fr]">
        <aside className="hidden border-r border-slate-400/70 bg-slate-200 lg:flex lg:flex-col">
          <div className="px-4 py-5">
            <p className="text-lg font-black tracking-tight text-[#430078]">C59 Estatehub</p>
          </div>
          <nav className="flex-1 space-y-2 px-3 py-3 text-sm text-slate-600">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`flex rounded-xl px-3 py-3 font-medium transition hover:bg-blue-50 hover:text-blue-700 ${
                  item.href === "/agents/profile" ? "bg-slate-300 text-slate-950" : ""
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-slate-300 p-3">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-300/70 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {initials(agentName)}
              </span>
              {isVerified ? <VerifiedAgentName fullName="" isVerified className="[&>span:first-child]:hidden" /> : null}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="border-b border-slate-400/70 bg-slate-200 px-3 py-3 sm:px-4 lg:px-6">
            <div className="space-y-3 lg:hidden">
              <div className="flex items-center gap-3">
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
                    <p className="truncate text-xs text-slate-500">{data.user.email}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden items-center justify-end lg:flex">
              <button className="text-sm font-semibold text-slate-600 hover:text-slate-950" onClick={logout}>
                Log out
              </button>
            </div>
          </div>

          <div className="space-y-5 p-3 sm:p-6">
            <section>
              <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Profile management</h1>
              <p className="mt-2 text-sm text-slate-600">
                Manage your personal information, contact details, and account settings.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full bg-slate-300 text-lg font-bold text-slate-600">
                    {initials(agentName)}
                    {isVerified ? (
                      <span className="absolute -bottom-1 -right-1">
                        <VerifiedAgentName fullName="" isVerified className="[&>span:first-child]:hidden" />
                      </span>
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <VerifiedAgentName
                      fullName={agentName}
                      isVerified={isVerified}
                      className="text-xl font-bold text-slate-950"
                    />
                    <p className="mt-1 text-sm text-slate-600">{data.user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Member since {formatDate(data.user.createdAt)}</p>
                  </div>
                </div>
                <button
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
                  onClick={() => setEditing((current) => !current)}
                >
                  {editing ? "Cancel Edit" : "Edit Profile"}
                </button>
              </div>
            </section>

            {editing ? (
              <form onSubmit={saveProfile} className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
                <h2 className="text-lg font-semibold text-slate-950">Edit profile</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Full name
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-950 outline-none"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Business name
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-950 outline-none"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      placeholder="Agency or business name"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      Optional. Listings and top-plan watermarks use this name when provided.
                    </span>
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Phone number
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-950 outline-none"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="Phone number"
                    />
                  </label>
                </div>
                <button
                  className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </form>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
                <h2 className="text-lg font-semibold text-slate-950">Personal Details</h2>
                <div className="mt-4 grid gap-5 border-t border-slate-300 pt-4 sm:grid-cols-2">
                  <DetailCard label="Public Listing Name" value={publicDisplayName} />
                  <DetailCard label="Business Name" value={data.profile.agent?.businessName ?? "Not provided"} />
                  <DetailCard label="Phone Number" value={data.user.phone ?? "Not provided"} />
                  <DetailCard label="Email Address" value={data.user.email} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-5">
                <h2 className="text-lg font-semibold text-slate-950">Account Details</h2>
                <div className="mt-4 grid gap-5 border-t border-slate-300 pt-4">
                  <DetailCard label="Verification Status" value={verificationStatus} />
                  <DetailCard label="Account Status" value={accountStatus} />
                  <DetailCard label="Subscription" value={`${currentPlan.name} (${formatPlanPrice(currentPlan.priceMonthly)})`} />
                </div>
              </div>
            </section>

            {message ? <p className="text-sm text-slate-600">{message}</p> : null}

            <section className="pb-2 lg:hidden">
              <button
                className="w-full rounded-xl bg-slate-300 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-400/70 hover:text-slate-950"
                onClick={logout}
              >
                Log out
              </button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

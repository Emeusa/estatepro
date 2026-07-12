"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminIdentityCard, AdminShell, statusPillClass } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { getListingImageCount } from "@/lib/listing-images";
import { AVAILABILITY_LABELS, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getListingQualityBadges } from "@/lib/listing-quality";
import { ADMIN_LEGAL_HOLD_DAYS, addDays, retentionSummary } from "@/lib/listing-retention";
import { getListingPromotionBadge } from "@/lib/listing-visibility";
import { formatPlanPrice, getPricingPlan, hasPriorityReview, hasPrioritySupport } from "@/lib/pricing";
import { getEffectivePlanSlug } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase/client";
import { AdminAgentDetails, AgentProfile, UserRecord } from "@/lib/types";

type AdminAgentResponse = {
  agent: AdminAgentDetails;
};

type AdminAccount = {
  user: UserRecord | null;
};

function verificationTone(status: AgentProfile["verificationStatus"], isBlocked: boolean) {
  if (isBlocked || status === "rejected") {
    return "red";
  }
  if (status === "approved") {
    return "green";
  }
  return "amber";
}

export default function AdminAgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const [review, setReview] = useState<AdminAgentDetails | null>(null);
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("Checking admin access...");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAgent() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (active) {
          setMessage("Log in with an admin account to continue.");
        }
        return;
      }

      try {
        const [agentData, adminAccount] = await Promise.all([
          apiRequest<AdminAgentResponse>(`/api/admin/agents/${agentId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          }),
          apiRequest<AdminAccount>("/api/auth/me", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
        ]);

        if (active) {
          setReview(agentData.agent);
          setAccount(adminAccount.user);
          setToken(session.access_token);
          setMessage("");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Failed to load agent.");
        }
      }
    }

    loadAgent();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      loadAgent();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [agentId]);

  async function moderateAgent(action: "approve" | "reject" | "block" | "unblock") {
    if (!review || !token) {
      return;
    }

    const body =
      action === "approve" || action === "reject"
        ? { verificationStatus: action === "approve" ? "approved" : "rejected" }
        : { isBlocked: action === "block" };

    try {
      setBusyAction(action);
      await apiRequest(`/api/admin/agents/${review.agent.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      setReview((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          agent: {
            ...current.agent,
            verificationStatus:
              action === "approve" ? "approved" : action === "reject" ? "rejected" : current.agent.verificationStatus,
            isBlocked: action === "block" ? true : action === "unblock" ? false : current.agent.isBlocked
          },
          listings:
            action === "approve"
              ? current.listings.map((listing) => ({
                  ...listing,
                  status: listing.status === "pending" ? "active" : listing.status
                }))
              : current.listings
        };
      });
      setMessage(`Agent ${action} action applied.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent moderation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateListingLegalHold(listingId: string, hold: boolean) {
    if (!token) {
      return;
    }

    const legalHoldUntil = hold ? addDays(new Date(), ADMIN_LEGAL_HOLD_DAYS).toISOString() : null;
    try {
      setBusyAction(`legal-hold:${listingId}`);
      const response = await apiRequest<{ listing: AdminAgentDetails["listings"][number] }>(
        `/api/admin/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ legalHoldUntil })
        }
      );
      setReview((current) =>
        current
          ? {
              ...current,
              listings: current.listings.map((listing) =>
                listing.id === listingId ? response.listing : listing
              )
            }
          : current
      );
      setMessage(hold ? "Listing legal hold applied." : "Listing legal hold cleared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update listing legal hold.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!review) {
    return (
      <div className="relative left-1/2 -my-8 min-h-screen w-screen -translate-x-1/2 bg-[#d7dce4] p-4">
        <div className="rounded-3xl bg-slate-200 p-6 shadow-sm">
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </div>
    );
  }

  const adminName = account?.fullName ?? "Admin";
  const adminEmail = account?.email ?? "Admin account";
  const statusTone = verificationTone(review.agent.verificationStatus, review.agent.isBlocked);
  const effectivePlanSlug = getEffectivePlanSlug(review.subscription);
  const currentPlan = getPricingPlan(effectivePlanSlug);
  const isPriorityAgent = hasPriorityReview(effectivePlanSlug);
  const isPrioritySupportAgent = hasPrioritySupport(effectivePlanSlug);

  return (
    <AdminShell active="agents" adminName={adminName} adminEmail={adminEmail}>
      <div className="space-y-4 pb-6 sm:space-y-5">
        <section className="flex flex-col gap-4 px-3 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/admin/agents" className="text-sm font-semibold text-blue-700 hover:text-blue-900">
              Back to agents
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{review.user.fullName}</h1>
            <p className="mt-2 text-sm text-slate-600">Agent profile, verification details, and listings.</p>
          </div>
          <AdminIdentityCard adminName={adminName} adminEmail={adminEmail} />
        </section>

        <section className="grid gap-4 px-3 sm:px-6 xl:grid-cols-[1fr_0.85fr]">
          <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-950">{review.user.fullName}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusPillClass(statusTone)}`}>
                    {review.agent.isBlocked ? "Blocked" : review.agent.verificationStatus}
                  </span>
                  {isPriorityAgent ? (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                      Priority review
                    </span>
                  ) : null}
                  {isPrioritySupportAgent ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Priority support
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-500">{review.user.email}</p>
                <p className="mt-1 text-sm text-slate-500">{review.user.phone ?? "No phone number"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {review.agent.verificationStatus !== "approved" ? (
                  <>
                    <button
                      className="button-secondary"
                      disabled={busyAction !== null}
                      onClick={() => moderateAgent("approve")}
                      type="button"
                    >
                      {busyAction === "approve" ? "Approving..." : "Approve"}
                    </button>
                    <button
                      className="button-secondary"
                      disabled={busyAction !== null}
                      onClick={() => moderateAgent("reject")}
                      type="button"
                    >
                      {busyAction === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                  </>
                ) : null}
                {review.agent.isBlocked ? (
                  <button
                    className="button-secondary"
                    disabled={busyAction !== null}
                    onClick={() => moderateAgent("unblock")}
                    type="button"
                  >
                    {busyAction === "unblock" ? "Unblocking..." : "Unblock"}
                  </button>
                ) : (
                  <button
                    className="button-secondary"
                    disabled={busyAction !== null}
                    onClick={() => moderateAgent("block")}
                    type="button"
                  >
                    {busyAction === "block" ? "Blocking..." : "Block"}
                  </button>
                )}
              </div>
            </div>

            <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Agent ID</dt>
                <dd className="mt-1 break-all font-medium text-slate-950">{review.agent.id}</dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Role</dt>
                <dd className="mt-1 font-medium capitalize text-slate-950">{review.user.role}</dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Verification</dt>
                <dd className="mt-1 font-medium capitalize text-slate-950">{review.agent.verificationStatus}</dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Account status</dt>
                <dd className="mt-1 font-medium text-slate-950">{review.agent.isBlocked ? "Blocked" : "Operational"}</dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Registered</dt>
                <dd className="mt-1 font-medium text-slate-950">{formatDate(review.user.createdAt)}</dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Trial ends</dt>
                <dd className="mt-1 font-medium text-slate-950">{formatDate(review.agent.trialEndsAt)}</dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Subscription</dt>
                <dd className="mt-1 font-medium text-slate-950">
                  {review.subscription?.isActive
                    ? `${currentPlan.name} (${formatPlanPrice(currentPlan.priceMonthly)})`
                    : "Inactive or unavailable"}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-300/60 p-4">
                <dt className="text-slate-500">Listings</dt>
                <dd className="mt-1 font-medium text-slate-950">{review.listings.length}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">NIN details</p>
            <p className="mt-3 break-all text-sm font-semibold text-slate-800">
              {review.agent.ninNumber ?? "No NIN provided for this agent."}
            </p>
            <div className="mt-6 rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-600">
              Admin-only verification information is shown here. Do not expose this data on public pages.
            </div>
            {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
          </div>
        </section>

        <section className="px-3 sm:px-6">
          <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Agent listings</h2>
                <p className="mt-1 text-sm text-slate-500">Listings load only on this agent profile page.</p>
              </div>
              <span className="text-sm font-semibold text-slate-600">{review.listings.length} total</span>
            </div>

            <div className="mt-4 space-y-3">
              {review.listings.length ? (
                review.listings.map((listing) => (
                  <article key={listing.id} className="rounded-2xl border border-slate-300 bg-slate-300/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-950">{listing.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {listing.location.area}, {listing.location.city}, {listing.location.state}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getListingPromotionBadge(listing) ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                            {getListingPromotionBadge(listing)}
                          </span>
                        ) : null}
                        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusPillClass(listing.status === "active" ? "green" : listing.status === "pending" || listing.status === "inactive" ? "amber" : "red")}`}>
                          {listing.status}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusPillClass(listing.availability === "available" ? "green" : "amber")}`}>
                          {AVAILABILITY_LABELS[listing.availability]}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-950">{formatPrice(listing.price)}</p>
                    {getListingQualityBadges(listing).length ? (
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        {getListingQualityBadges(listing).slice(0, 5).join(" • ")}
                      </p>
                    ) : null}
                    {retentionSummary(listing) ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">{retentionSummary(listing)}</p>
                    ) : null}
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{listing.description}</p>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
                      <span>{LISTING_CATEGORY_LABELS[listing.listingCategory]}</span>
                      <span className="capitalize">{listing.propertyType}</span>
                      <span>Created: {formatDate(listing.createdAt)}</span>
                      <span>Images: {getListingImageCount(listing)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-200 disabled:opacity-60"
                        disabled={busyAction === `legal-hold:${listing.id}`}
                        onClick={() => updateListingLegalHold(listing.id, !listing.legalHoldUntil)}
                        type="button"
                      >
                        {listing.legalHoldUntil ? "Clear legal hold" : "Hold cleanup"}
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-500">
                  This agent has not created listings yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AdminIdentityCard, AdminShell, statusPillClass } from "@/components/admin/admin-shell";
import { apiRequest } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { getListingImageCount } from "@/lib/listing-images";
import { AVAILABILITY_LABELS, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getListingQualityBadges } from "@/lib/listing-quality";
import { ADMIN_LEGAL_HOLD_DAYS, addDays, retentionSummary } from "@/lib/listing-retention";
import { getListingPromotionBadge } from "@/lib/listing-visibility";
import { formatPlanPrice, getPricingPlan, hasPriorityReview, hasPrioritySupport } from "@/lib/pricing";
import { getEffectivePlanSlug, isSubscriptionCurrentlyActive } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase/client";
import { AdminAgentDetails, AgentProfile, SubscriptionAdminGrantRecord, SubscriptionRecord, UserRecord } from "@/lib/types";

type AdminAgentResponse = {
  agent: AdminAgentDetails;
};

type AdminAccount = {
  user: UserRecord | null;
};

type PromoPlanSlug = "free_starter" | "starter_agent" | "growth_agent" | "pro_agent" | "agency_plus";

type AdminSubscriptionGrantResponse = {
  subscription: SubscriptionRecord;
  grant: SubscriptionAdminGrantRecord;
};

const promoPlanSlugs: PromoPlanSlug[] = [
  "free_starter",
  "starter_agent",
  "growth_agent",
  "pro_agent",
  "agency_plus"
];

const promoDurationPresets = [30, 60, 90, 180];

function verificationTone(status: AgentProfile["verificationStatus"], isBlocked: boolean) {
  if (isBlocked || status === "rejected") {
    return "red";
  }
  if (status === "approved") {
    return "green";
  }
  return "amber";
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function expiryIsoFromDateInput(value: string) {
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

export default function AdminAgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params.agentId;
  const [review, setReview] = useState<AdminAgentDetails | null>(null);
  const [account, setAccount] = useState<UserRecord | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("Checking admin access...");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [promoPlanSlug, setPromoPlanSlug] = useState<PromoPlanSlug>("agency_plus");
  const [promoExpiresAt, setPromoExpiresAt] = useState(() => dateInputValue(addDays(new Date(), 90)));
  const [promoReason, setPromoReason] = useState("Launch promo");

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

  async function grantPromoPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review || !token) {
      return;
    }

    const body: Record<string, string> = {
      planSlug: promoPlanSlug,
      reason: promoReason
    };
    if (promoPlanSlug !== "free_starter" && promoExpiresAt) {
      body.expiresAt = expiryIsoFromDateInput(promoExpiresAt);
    }

    try {
      setBusyAction("subscription-grant");
      const response = await apiRequest<AdminSubscriptionGrantResponse>(
        `/api/admin/agents/${review.agent.id}/subscription-grant`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        }
      );

      setReview((current) =>
        current
          ? {
              ...current,
              subscription: response.subscription,
              subscriptionGrants: [response.grant, ...(current.subscriptionGrants ?? [])].slice(0, 5)
            }
          : current
      );
      setMessage(`${getPricingPlan(response.subscription.planSlug).name} promo grant applied.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not grant promo plan.");
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
  const currentSubscription = review.subscription;
  const hasActiveRecurringPaystack =
    currentSubscription !== null &&
    isSubscriptionCurrentlyActive(currentSubscription) &&
    currentSubscription.paymentProvider === "paystack" &&
    currentSubscription.billingMode === "recurring";
  const selectedPromoPlan = getPricingPlan(promoPlanSlug);

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

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Verification details</p>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">NIN</dt>
                  <dd className="mt-1 break-all font-semibold text-slate-800">
                    {review.agent.ninNumber ?? "No NIN provided."}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">CAC registration number</dt>
                  <dd className="mt-1 break-all font-semibold text-slate-800">
                    {review.agent.cacNumber ?? "No CAC provided."}
                  </dd>
                </div>
              </dl>
              <div className="mt-6 rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-600">
                Admin-only verification information is shown here. Do not expose this data on public pages.
              </div>
              {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
            </div>

            <div className="rounded-2xl border border-slate-300/80 bg-slate-200 p-4 shadow-sm sm:rounded-3xl sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Grant promo plan</p>
              <div className="mt-3 rounded-2xl bg-slate-300/60 p-4 text-sm text-slate-700">
                <p>
                  Current: <span className="font-black text-slate-950">{currentPlan.name}</span>
                </p>
                <p className="mt-1 text-xs font-semibold capitalize text-slate-500">
                  {review.subscription
                    ? `${review.subscription.paymentProvider} / ${review.subscription.billingMode} / ${review.subscription.status}`
                    : "No subscription record"}
                </p>
                {review.subscription?.currentPeriodEnd ? (
                  <p className="mt-1 text-xs font-bold text-emerald-700">
                    Expires {formatDate(review.subscription.currentPeriodEnd)}
                  </p>
                ) : null}
              </div>

              {hasActiveRecurringPaystack ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                  Cancel or wait for the active paid subscription before applying a manual promo grant.
                </p>
              ) : null}

              <form className="mt-4 space-y-3" onSubmit={grantPromoPlan}>
                <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Plan
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-950"
                    disabled={busyAction !== null || hasActiveRecurringPaystack}
                    onChange={(event) => setPromoPlanSlug(event.target.value as PromoPlanSlug)}
                    value={promoPlanSlug}
                  >
                    {promoPlanSlugs.map((planSlug) => (
                      <option key={planSlug} value={planSlug}>
                        {getPricingPlan(planSlug).name}
                      </option>
                    ))}
                  </select>
                </label>

                {promoPlanSlug !== "free_starter" ? (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      Valid until
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-950"
                        disabled={busyAction !== null || hasActiveRecurringPaystack}
                        min={dateInputValue(addDays(new Date(), 1))}
                        onChange={(event) => setPromoExpiresAt(event.target.value)}
                        type="date"
                        value={promoExpiresAt}
                      />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {promoDurationPresets.map((days) => (
                        <button
                          className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-300 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60"
                          disabled={busyAction !== null || hasActiveRecurringPaystack}
                          key={days}
                          onClick={() => setPromoExpiresAt(dateInputValue(addDays(new Date(), days)))}
                          type="button"
                        >
                          {days} days
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl bg-white/70 p-3 text-xs font-semibold leading-5 text-slate-600">
                    Free Starter resets the agent to the default free limits immediately and does not expire.
                  </p>
                )}

                <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Admin reason
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-950"
                    disabled={busyAction !== null || hasActiveRecurringPaystack}
                    maxLength={240}
                    minLength={3}
                    onChange={(event) => setPromoReason(event.target.value)}
                    required
                    type="text"
                    value={promoReason}
                  />
                </label>

                <button
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busyAction !== null || hasActiveRecurringPaystack}
                  type="submit"
                >
                  {busyAction === "subscription-grant" ? "Applying grant..." : `Apply ${selectedPromoPlan.name}`}
                </button>
              </form>

              <div className="mt-5 border-t border-slate-300 pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Recent grants</p>
                {review.subscriptionGrants?.length ? (
                  <div className="mt-3 space-y-2">
                    {review.subscriptionGrants.slice(0, 5).map((grant) => (
                      <div key={grant.id} className="rounded-2xl bg-slate-300/60 p-3 text-xs text-slate-600">
                        <p className="font-black text-slate-950">{getPricingPlan(grant.planSlug).name}</p>
                        <p className="mt-1">
                          {formatDate(grant.periodStart)}
                          {grant.periodEnd ? ` - ${formatDate(grant.periodEnd)}` : " - no expiry"}
                        </p>
                        <p className="mt-1 font-semibold">{grant.reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl bg-slate-300/60 p-3 text-xs font-semibold text-slate-500">
                    No manual promo grants yet.
                  </p>
                )}
              </div>
            </div>
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

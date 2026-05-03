"use client";

import { useEffect, useState } from "react";

import { apiRequest } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { AdminAgentReview } from "@/lib/types";

type Props = {
  token: string;
  agents: AdminAgentReview[];
};

export function AdminModeration({ token, agents }: Props) {
  const [reviews, setReviews] = useState(agents);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.agent.id ?? "");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    setReviews(agents);
    setSelectedAgentId((current) =>
      agents.some((review) => review.agent.id === current) ? current : agents[0]?.agent.id ?? ""
    );
  }, [agents]);

  const selected = reviews.find((review) => review.agent.id === selectedAgentId) ?? reviews[0];

  async function moderateAgent(agentId: string, action: "approve" | "reject" | "block" | "unblock") {
    const body =
      action === "approve" || action === "reject"
        ? { verificationStatus: action === "approve" ? "approved" : "rejected" }
        : { isBlocked: action === "block" };

    try {
      setBusyAction(`${agentId}:${action}`);
      await apiRequest(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      setReviews((current) =>
        current.map((review) => {
          if (review.agent.id !== agentId) {
            return review;
          }

          return {
            ...review,
            agent: {
              ...review.agent,
              verificationStatus:
                action === "approve" ? "approved" : action === "reject" ? "rejected" : review.agent.verificationStatus,
              isBlocked: action === "block" ? true : action === "unblock" ? false : review.agent.isBlocked
            },
            listings:
              action === "approve"
                ? review.listings.map((listing) => ({
                    ...listing,
                    status: listing.status === "pending" ? "active" : listing.status
                  }))
                : review.listings
          };
        })
      );

      setMessage(`Agent ${action} action applied.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Agent moderation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  if (!selected) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Agent reviews</h1>
        <p className="mt-2 text-sm text-slate-500">No agents are available for review.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Agents</h2>
        <div className="mt-4 space-y-2">
          {reviews.map((review) => (
            <button
              key={review.agent.id}
              className={`w-full rounded-2xl border p-4 text-left text-sm transition ${
                selected.agent.id === review.agent.id
                  ? "border-teal-600 bg-teal-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              onClick={() => setSelectedAgentId(review.agent.id)}
            >
              <span className="block font-medium text-slate-950">{review.user.fullName}</span>
              <span className="mt-1 block text-slate-500">{review.user.email}</span>
              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-600">
                {review.agent.verificationStatus}
              </span>
              <span className="ml-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {review.listings.length} listing{review.listings.length === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">{selected.user.fullName}</h1>
              <p className="mt-1 text-sm text-slate-500">{selected.user.email}</p>
              <p className="mt-1 text-sm text-slate-500">{selected.user.phone ?? "No phone number"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.agent.verificationStatus !== "approved" ? (
                <>
                  <button
                    className="button-secondary"
                    disabled={busyAction !== null}
                    onClick={() => moderateAgent(selected.agent.id, "approve")}
                  >
                    {busyAction === `${selected.agent.id}:approve` ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className="button-secondary"
                    disabled={busyAction !== null}
                    onClick={() => moderateAgent(selected.agent.id, "reject")}
                  >
                    {busyAction === `${selected.agent.id}:reject` ? "Rejecting..." : "Reject"}
                  </button>
                </>
              ) : null}
              {selected.agent.isBlocked ? (
                <button
                  className="button-secondary"
                  disabled={busyAction !== null}
                  onClick={() => moderateAgent(selected.agent.id, "unblock")}
                >
                  {busyAction === `${selected.agent.id}:unblock` ? "Unblocking..." : "Unblock"}
                </button>
              ) : (
                <button
                  className="button-secondary"
                  disabled={busyAction !== null}
                  onClick={() => moderateAgent(selected.agent.id, "block")}
                >
                  {busyAction === `${selected.agent.id}:block` ? "Blocking..." : "Block"}
                </button>
              )}
            </div>
          </div>

          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">Agent ID</dt>
              <dd className="mt-1 break-all font-medium text-slate-950">{selected.agent.id}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">Verification</dt>
              <dd className="mt-1 font-medium capitalize text-slate-950">{selected.agent.verificationStatus}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">Account status</dt>
              <dd className="mt-1 font-medium text-slate-950">{selected.agent.isBlocked ? "Blocked" : "Operational"}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-1 font-medium capitalize text-slate-950">{selected.user.role}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">Registered</dt>
              <dd className="mt-1 font-medium text-slate-950">{formatDate(selected.user.createdAt)}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">Trial ends</dt>
              <dd className="mt-1 font-medium text-slate-950">{formatDate(selected.agent.trialEndsAt)}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-950">Verification documents</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {selected.agent.verificationDocuments.length ? (
                selected.agent.verificationDocuments.map((documentPath, index) => (
                  <a
                    key={documentPath}
                    className="button-secondary"
                    href={documentPath}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Document {index + 1}
                  </a>
                ))
              ) : (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Listings</h2>
          <div className="mt-4 space-y-3">
            {selected.listings.length ? (
              selected.listings.map((listing) => (
                <article key={listing.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="font-medium text-slate-950">{listing.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {listing.location.area}, {listing.location.city}, {listing.location.state}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs capitalize text-slate-600">
                      {listing.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">{formatPrice(listing.price)}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{listing.description}</p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <span>Phone: {listing.contactPhone}</span>
                    <span>WhatsApp: {listing.contactWhatsapp}</span>
                    <span>Created: {formatDate(listing.createdAt)}</span>
                    <span>Images: {listing.imageUrls.length}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-500">This agent has not created listings yet.</p>
            )}
          </div>
          {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}

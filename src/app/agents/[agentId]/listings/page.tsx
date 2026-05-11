import { notFound } from "next/navigation";

import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { ListingGrid } from "@/components/listings/listing-grid";
import { getPublicAgentListings } from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ agentId: string }>;
};

export default async function AgentListingsPage({ params }: Props) {
  const { agentId } = await params;
  const data = await getPublicAgentListings(agentId);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Agent properties</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Other properties from{" "}
          <VerifiedAgentName fullName={data.agent.fullName} isVerified={data.agent.isVerified} />
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          These are active listings from an approved agent.
        </p>
      </section>
      <ListingGrid listings={data.listings} />
    </div>
  );
}

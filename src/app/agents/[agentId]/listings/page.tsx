import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { ListingGrid } from "@/components/listings/listing-grid";
import { SITE_NAME } from "@/lib/seo";
import { getPublicAgentListings } from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ agentId: string }>;
};

const getAgentListingsForPage = cache(getPublicAgentListings);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agentId } = await params;
  const data = await getAgentListingsForPage(agentId);

  if (!data) {
    return {
      title: {
        absolute: `Agent Properties Not Found | ${SITE_NAME}`
      },
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const title = `Properties from ${data.agent.displayName} | ${SITE_NAME}`;
  const description = `Browse active verified property listings from ${data.agent.displayName} on ${SITE_NAME}.`;

  return {
    title: {
      absolute: title
    },
    description,
    robots: data.listings.length
      ? undefined
      : {
          index: false,
          follow: true
        },
    alternates: {
      canonical: `/agents/${agentId}/listings`
    },
    openGraph: {
      title,
      description,
      url: `/agents/${agentId}/listings`,
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function AgentListingsPage({ params }: Props) {
  const { agentId } = await params;
  const data = await getAgentListingsForPage(agentId);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Agent properties</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Other properties from{" "}
          <VerifiedAgentName fullName={data.agent.displayName} isVerified={data.agent.isVerified} />
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {data.listings.length
            ? "These are active listings from an approved agent."
            : "This approved agent does not have active public listings right now."}
        </p>
      </section>
      <ListingGrid listings={data.listings} />
    </div>
  );
}

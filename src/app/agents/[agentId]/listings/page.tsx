import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { ListingGrid } from "@/components/listings/listing-grid";
import { formatDate } from "@/lib/format";
import { getPublicStateLabel } from "@/lib/property-search";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";
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
  const activeMarkets = Array.from(new Set(data.listings.map((listing) => getPublicStateLabel(listing.location.state))));
  const latestUpdate = data.listings.map((listing) => listing.updatedAt).sort((first, second) => second.localeCompare(first))[0];
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const agentJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: data.agent.displayName,
    url: `${siteUrl}/agents/${agentId}/listings`,
    areaServed: activeMarkets,
    memberOf: { "@type": "Organization", name: SITE_NAME, url: siteUrl }
  };

  return (
    <div className="space-y-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(agentJsonLd) }} />
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
        {activeMarkets.length ? <p className="mt-3 text-xs font-bold text-teal-700">Active markets: {activeMarkets.join(", ")}</p> : null}
        {latestUpdate ? <p className="mt-1 text-xs font-semibold text-slate-500">Latest listing update: {formatDate(latestUpdate)}</p> : null}
      </section>
      <ListingGrid listings={data.listings} />
    </div>
  );
}

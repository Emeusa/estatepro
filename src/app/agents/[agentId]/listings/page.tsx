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
  searchParams: Promise<{ page?: string | string[] }>;
};

const getAgentListingsForPage = cache(getPublicAgentListings);

function readPage(value?: string | string[]) {
  const parsed = Number(typeof value === "string" ? value : "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ agentId }, query] = await Promise.all([params, searchParams]);
  const page = readPage(query.page);
  const data = await getAgentListingsForPage(agentId, page);

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

  const baseTitle = `Properties from ${data.agent.displayName} | ${SITE_NAME}`;
  const title = page > 1 ? `${baseTitle} - Page ${page}` : baseTitle;
  const description = `Browse active verified property listings from ${data.agent.displayName} on ${SITE_NAME}.`;

  return {
    title: {
      absolute: title
    },
    description,
    robots: data.listings.pagination.totalItems
      ? undefined
      : {
          index: false,
          follow: true
        },
    alternates: {
      canonical: page > 1 ? `/agents/${agentId}/listings?page=${page}` : `/agents/${agentId}/listings`
    },
    openGraph: {
      title,
      description,
      url: page > 1 ? `/agents/${agentId}/listings?page=${page}` : `/agents/${agentId}/listings`,
      type: "website"
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function AgentListingsPage({ params, searchParams }: Props) {
  const [{ agentId }, query] = await Promise.all([params, searchParams]);
  const page = readPage(query.page);
  const data = await getAgentListingsForPage(agentId, page);

  if (!data) {
    notFound();
  }
  if (page > data.listings.pagination.totalPages && data.listings.pagination.totalItems > 0) notFound();
  const activeMarkets = Array.from(new Set(data.listings.items.map((listing) => getPublicStateLabel(listing.location.state))));
  const latestUpdate = data.listings.items.map((listing) => listing.updatedAt).sort((first, second) => second.localeCompare(first))[0];
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
          {data.listings.pagination.totalItems
            ? "These are active listings from an approved agent."
            : "This approved agent does not have active public listings right now."}
        </p>
        {activeMarkets.length ? <p className="mt-3 text-xs font-bold text-teal-700">Active markets: {activeMarkets.join(", ")}</p> : null}
        {latestUpdate ? <p className="mt-1 text-xs font-semibold text-slate-500">Latest listing update: {formatDate(latestUpdate)}</p> : null}
      </section>
      <ListingGrid
        listings={data.listings.items}
        pagination={{ ...data.listings.pagination, basePath: `/agents/${agentId}/listings` }}
      />
    </div>
  );
}

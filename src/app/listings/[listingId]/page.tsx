import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ListingDetail } from "@/components/listings/listing-detail";
import { buildListingMetaDescription, buildListingMetaTitle, SITE_NAME } from "@/lib/seo";
import { getPublicListingDetails } from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

const getListingDetailsForPage = cache(getPublicListingDetails);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listingId } = await params;
  const details = await getListingDetailsForPage(listingId);

  if (!details) {
    return {
      title: {
        absolute: `Listing Not Found | ${SITE_NAME}`
      },
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const { listing } = details;
  const title = buildListingMetaTitle(listing);
  const description = buildListingMetaDescription(listing);
  const image = listing.imageUrls[0];

  return {
    title: {
      absolute: title
    },
    description,
    alternates: {
      canonical: `/listings/${listing.id}`
    },
    openGraph: {
      title,
      description,
      url: `/listings/${listing.id}`,
      type: "article",
      images: image ? [{ url: image, alt: listing.title }] : undefined
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined
    }
  };
}

export default async function ListingPage({ params }: Props) {
  const { listingId } = await params;
  const details = await getListingDetailsForPage(listingId);

  if (!details) {
    notFound();
  }

  return (
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 bg-gradient-to-br from-stone-300 via-stone-200 to-slate-300 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <ListingDetail details={details} />
      </div>
    </div>
  );
}

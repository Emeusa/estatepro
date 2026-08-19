import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { ListingDetail } from "@/components/listings/listing-detail";
import { getListingHeroImage } from "@/lib/listing-images";
import { isUuidListingIdentifier } from "@/lib/listing-slugs";
import { getListingHref } from "@/lib/listing-urls";
import { buildPropertyMarketPath, getPublicStateLabel } from "@/lib/property-search";
import { buildListingMetaDescription, buildListingMetaTitle, formatListingLocation, getSiteUrl, SITE_NAME } from "@/lib/seo";
import { getPublicListingDetails, getSimilarListingsForPublicListing } from "@/modules/listings/listing.service";

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
  if (isUuidListingIdentifier(listingId) && listing.slug !== listing.id) {
    permanentRedirect(getListingHref(listing));
  }
  const title = buildListingMetaTitle(listing);
  const description = buildListingMetaDescription(listing);
  const image = getListingHeroImage(listing)?.heroUrl;
  const listingHref = getListingHref(listing);

  return {
    title: {
      absolute: title
    },
    description,
    alternates: {
      canonical: listingHref
    },
    openGraph: {
      title,
      description,
      url: listingHref,
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

  if (isUuidListingIdentifier(listingId) && details.listing.slug !== details.listing.id) {
    permanentRedirect(getListingHref(details.listing));
  }

  const similarListings = await getSimilarListingsForPublicListing(details.listing, 3);
  const siteUrl = getSiteUrl().toString().replace(/\/$/, "");
  const listingUrl = `${siteUrl}${getListingHref(details.listing)}`;
  const statePath = buildPropertyMarketPath({ state: details.listing.location.state });
  const marketPath = buildPropertyMarketPath({
    state: details.listing.location.state,
    city: details.listing.location.city,
    category: details.listing.listingCategory
  });
  const areaPath = details.listing.location.areaSlug
    ? buildPropertyMarketPath({
        state: details.listing.location.state,
        city: details.listing.location.city,
        areaSlug: details.listing.location.areaSlug,
        category: details.listing.listingCategory
      })
    : null;
  const subtypePath = details.listing.propertySubtype
    ? buildPropertyMarketPath({
        state: details.listing.location.state,
        city: details.listing.location.city,
        areaSlug: details.listing.location.areaSlug,
        category: details.listing.listingCategory,
        propertySubtype: details.listing.propertySubtype
      })
    : buildPropertyMarketPath({
        state: details.listing.location.state,
        city: details.listing.location.city,
        category: details.listing.listingCategory,
        propertyType: details.listing.propertyType
      });
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Properties", item: `${siteUrl}/properties` },
      { "@type": "ListItem", position: 3, name: getPublicStateLabel(details.listing.location.state), item: `${siteUrl}${statePath}` },
      { "@type": "ListItem", position: 4, name: details.listing.location.city, item: `${siteUrl}${marketPath}` },
      { "@type": "ListItem", position: 5, name: details.listing.title, item: listingUrl }
    ]
  };
  const listingJsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: details.listing.title,
    description: details.listing.description,
    url: listingUrl,
    datePosted: details.listing.createdAt,
    dateModified: details.listing.updatedAt,
    image: details.listing.imageVariants.map((image) => image.heroUrl).filter(Boolean),
    address: {
      "@type": "PostalAddress",
      addressLocality: details.listing.location.city,
      addressRegion: getPublicStateLabel(details.listing.location.state),
      streetAddress: details.listing.location.area,
      addressCountry: "NG"
    },
    offers: {
      "@type": "Offer",
      price: details.listing.price,
      priceCurrency: "NGN",
      availability: details.listing.availability === "available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: listingUrl,
      seller: { "@type": "RealEstateAgent", name: details.agent.displayName }
    },
    mainEntityOfPage: listingUrl,
    areaServed: formatListingLocation(details.listing)
  };

  return (
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 bg-gradient-to-br from-stone-300 via-stone-200 to-slate-300 px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listingJsonLd) }} />
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Browse related property markets" className="mb-4 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
          <span className="py-2 text-slate-500">Browse:</span>
          <Link href={statePath} className="rounded-full bg-white/70 px-3 py-2 hover:bg-white">
            {getPublicStateLabel(details.listing.location.state)} properties
          </Link>
          <Link href={marketPath} className="rounded-full bg-white/70 px-3 py-2 hover:bg-white">
            {details.listing.location.city}
          </Link>
          {areaPath ? (
            <Link href={areaPath} className="rounded-full bg-white/70 px-3 py-2 hover:bg-white">
              {details.listing.location.area}
            </Link>
          ) : null}
          <Link href={subtypePath} className="rounded-full bg-white/70 px-3 py-2 hover:bg-white">
            Similar properties
          </Link>
        </nav>
        <ListingDetail details={details} similarListings={similarListings} />
      </div>
    </div>
  );
}

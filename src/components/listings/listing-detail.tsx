import Image from "next/image";
import Link from "next/link";

import { VerifiedAgentName } from "@/components/agents/verified-agent-name";
import { formatDate, formatPrice, whatsappLink } from "@/lib/format";
import { getListingImages } from "@/lib/listing-images";
import { AVAILABILITY_LABELS, getUnavailableBadge, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import {
  FURNISHING_STATUS_LABELS,
  LAND_SIZE_UNIT_LABELS,
  PROPERTY_CONDITION_LABELS,
  PROPERTY_SIZE_UNIT_LABELS,
  ROAD_ACCESS_LABELS,
  SERVICING_STATUS_LABELS,
  TITLE_DOCUMENT_TYPE_LABELS,
  ZONING_TYPE_LABELS,
  formatCount,
  formatSize
} from "@/lib/listing-quality";
import { PublicListingDetails } from "@/lib/types";

type Props = {
  details: PublicListingDetails;
};

function DetailRow({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-white/55 p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function ChipSection({ title, values }: { title: string; values: string[] }) {
  if (!values.length) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className="rounded-full bg-slate-950/5 px-3 py-1 text-xs font-semibold text-slate-700">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ListingDetail({ details }: Props) {
  const { agent, listing } = details;
  const images = getListingImages(listing);
  const heroImage = images[0];
  const unavailableBadge = getUnavailableBadge(listing);
  const floorValue = listing.floorLevel
    ? `${listing.floorLevel}${listing.totalFloors ? ` of ${listing.totalFloors}` : ""}`
    : null;
  const detailRows = [
    ["Bedrooms", formatCount(listing.bedrooms, "bedroom", "bedrooms")],
    ["Bathrooms", formatCount(listing.bathrooms, "bathroom", "bathrooms")],
    ["Toilets", formatCount(listing.toilets, "toilet", "toilets")],
    ["Parking", formatCount(listing.parkingSpaces, "space", "spaces")],
    ["Property size", formatSize(listing.propertySize, listing.propertySizeUnit, PROPERTY_SIZE_UNIT_LABELS)],
    ["Year built", listing.yearBuilt ? listing.yearBuilt.toString() : null],
    ["Floor", floorValue],
    ["Furnishing", listing.furnishingStatus ? FURNISHING_STATUS_LABELS[listing.furnishingStatus] : null],
    ["Servicing", listing.servicingStatus ? SERVICING_STATUS_LABELS[listing.servicingStatus] : null],
    ["Condition", listing.propertyCondition ? PROPERTY_CONDITION_LABELS[listing.propertyCondition] : null],
    ["Land size", formatSize(listing.landSize, listing.landSizeUnit, LAND_SIZE_UNIT_LABELS)],
    ["Title document", listing.titleDocumentType ? TITLE_DOCUMENT_TYPE_LABELS[listing.titleDocumentType] : null],
    ["Zoning", listing.zoningType ? ZONING_TYPE_LABELS[listing.zoningType] : null],
    ["Road access", listing.roadAccess ? ROAD_ACCESS_LABELS[listing.roadAccess] : null]
  ] satisfies Array<[string, string | null]>;
  const hasQualityDetails =
    detailRows.some(([, value]) => Boolean(value)) ||
    listing.amenities.length ||
    listing.utilities.length ||
    listing.safetyFeatures.length ||
    listing.nearbyLandmarks.length ||
    listing.extraFeatures.length;

  return (
    <section className="rounded-[2rem] bg-gradient-to-br from-stone-300 via-stone-200 to-slate-300 p-3 shadow-sm sm:p-5">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-4">
        <div className="relative h-72 overflow-hidden rounded-3xl bg-stone-200 md:h-[28rem]">
          {heroImage ? (
            <Image
              src={heroImage.heroUrl}
              alt={listing.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 780px"
              quality={78}
              unoptimized={heroImage.isPreprocessed}
              {...(heroImage.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: heroImage.blurDataUrl } : {})}
            />
          ) : null}
          {unavailableBadge ? (
            <span className="absolute left-4 top-4 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {unavailableBadge}
            </span>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {images.slice(1, 4).map((image) => (
            <div key={image.heroUrl} className="relative h-28 overflow-hidden rounded-2xl bg-stone-200">
              <Image
                src={image.cardUrl}
                alt={listing.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 240px"
                quality={70}
                unoptimized={image.isPreprocessed}
                {...(image.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: image.blurDataUrl } : {})}
              />
            </div>
          ))}
        </div>
        <div className="rounded-3xl bg-white/65 p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">{listing.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {listing.location.area}, {listing.location.city}, {listing.location.state}
          </p>
          <p className="mt-3 text-sm text-slate-700">
            Listed by{" "}
            <VerifiedAgentName
              fullName={agent.fullName}
              isVerified={agent.isVerified}
              className="font-medium text-slate-950"
            />
          </p>
          <p className="mt-4 text-lg font-semibold text-slate-950">{formatPrice(listing.price)}</p>
          <p className="mt-6 text-sm leading-7 text-slate-800">{listing.description}</p>
        </div>
        {hasQualityDetails ? (
          <div className="rounded-3xl bg-white/65 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Property details</h2>
            {detailRows.some(([, value]) => Boolean(value)) ? (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {detailRows.map(([label, value]) => (
                  <DetailRow key={label} label={label} value={value} />
                ))}
              </dl>
            ) : null}
            <div className="mt-5 space-y-5">
              <ChipSection title="Amenities" values={listing.amenities} />
              <ChipSection title="Utilities" values={listing.utilities} />
              <ChipSection title="Safety features" values={listing.safetyFeatures} />
              <ChipSection title="Nearby landmarks" values={listing.nearbyLandmarks} />
              <ChipSection title="Extra features" values={listing.extraFeatures} />
            </div>
          </div>
        ) : null}
      </div>
      <aside className="rounded-3xl bg-white/65 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Contact agent</p>
        <Link
          href={`/agents/${listing.agentId}/listings`}
          className="mt-3 block rounded-2xl bg-white/55 px-4 py-3 text-base text-slate-700 transition hover:bg-white/75 hover:text-slate-950"
        >
          <VerifiedAgentName
            fullName={agent.fullName}
            isVerified={agent.isVerified}
            className="font-semibold text-slate-950"
          />
        </Link>
        <div className="mt-4 space-y-3">
          <a
            href={`tel:${listing.contactPhone}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white"
          >
            Call {listing.contactPhone}
          </a>
          <a
            href={whatsappLink(listing.contactWhatsapp, listing.title)}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white"
          >
            Chat on WhatsApp
          </a>
          <Link
            href={`/agents/${listing.agentId}/listings`}
            className="flex w-full items-center justify-center rounded-2xl bg-amber-100 px-4 py-3 text-sm font-medium text-amber-900"
          >
            View other properties from this agent
          </Link>
        </div>
        <dl className="mt-6 space-y-4 text-sm text-slate-700">
          <div className="flex justify-between gap-4">
            <dt>Category</dt>
            <dd className="font-medium text-slate-950">{LISTING_CATEGORY_LABELS[listing.listingCategory]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Availability</dt>
            <dd className="font-medium text-slate-950">{AVAILABILITY_LABELS[listing.availability]}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Type</dt>
            <dd className="font-medium text-slate-950">{listing.propertyType}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd className="font-medium capitalize text-slate-950">{listing.status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Updated</dt>
            <dd className="font-medium text-slate-950">{formatDate(listing.updatedAt)}</dd>
          </div>
        </dl>
      </aside>
      </div>
      <div className="mt-6 space-y-2 px-1 text-xs leading-6 text-slate-700 sm:px-2">
        <p className="font-semibold text-slate-900">Disclaimer</p>
        <p>
          The information displayed about this property comprises a property advertisement. C59 Estatehub makes no
          warranty as to the accuracy or completeness of the advertisement or any linked or associated information, and
          C59 Estatehub has no control over the content. This property listing does not constitute property particulars.
          The information is provided and maintained by {agent.fullName}. C59 Estatehub shall not in any way be held
          liable for the actions of any agent or property owner/landlord on or off this website.
        </p>
        <p className="pt-3 font-semibold text-slate-900">Safety Tips</p>
        <ul className="space-y-1">
          <li>Do not make any inspection fee without seeing the agent and property.</li>
          <li>Only pay Rental fee, Sales fee or any upfront payment after you verify the Landlord.</li>
          <li>Ensure you meet the Agent in an open location.</li>
          <li>
            The Agent does not represent C59 Estatehub and C59 Estatehub is not liable for any monetary transaction
            between you and the Agent.
          </li>
        </ul>
      </div>
    </section>
  );
}

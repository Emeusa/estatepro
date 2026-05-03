import { notFound } from "next/navigation";

import { ListingDetail } from "@/components/listings/listing-detail";
import { getPublicListingDetails } from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

export default async function ListingPage({ params }: Props) {
  const { listingId } = await params;
  const listing = await getPublicListingDetails(listingId);

  if (!listing) {
    notFound();
  }

  return <ListingDetail listing={listing} />;
}

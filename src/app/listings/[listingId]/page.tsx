import { notFound } from "next/navigation";

import { ListingDetail } from "@/components/listings/listing-detail";
import { getPublicListingDetails } from "@/modules/listings/listing.service";

type Props = {
  params: Promise<{ listingId: string }>;
};

export default async function ListingPage({ params }: Props) {
  const { listingId } = await params;
  const details = await getPublicListingDetails(listingId);

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

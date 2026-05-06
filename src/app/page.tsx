import { FilterBar } from "@/components/listings/filter-bar";
import { ListingGrid } from "@/components/listings/listing-grid";
import { getPublicListings } from "@/modules/listings/listing.service";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const listings = await getPublicListings({
    state: typeof params.state === "string" ? params.state : undefined,
    city: typeof params.city === "string" ? params.city : undefined,
    maxPrice: typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined,
    propertyType: typeof params.propertyType === "string" ? params.propertyType : undefined
  });

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-slate-950 px-6 py-10 text-white">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-200">Property search</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          Discover verified homes and commercial spaces without heavy pages or slow flows.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          Built for mobile-first browsing, low bandwidth, and fast contact with verified agents.
        </p>
      </section>
      <FilterBar
        initialState={typeof params.state === "string" ? params.state : undefined}
        initialCity={typeof params.city === "string" ? params.city : undefined}
        initialMaxPrice={typeof params.maxPrice === "string" ? Number(params.maxPrice) : undefined}
        initialType={typeof params.propertyType === "string" ? params.propertyType : undefined}
      />
      <ListingGrid listings={listings.items} />
    </div>
  );
}

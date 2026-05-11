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
      <section
        className="relative left-1/2 -mt-8 w-screen -translate-x-1/2 overflow-hidden bg-slate-950 px-4 py-1 text-center text-amber-50 sm:px-6 sm:py-3 lg:py-4"
        style={{
          backgroundImage: 'url("/pageima.PNG")',
          backgroundPosition: "center",
          backgroundSize: "cover"
        }}
      >
        <div className="absolute inset-0 bg-stone-950/85 mix-blend-multiply" aria-hidden="true" />
        <div className="absolute inset-0 bg-slate-950/84" aria-hidden="true" />
        <div className="relative">
          <p className="text-[clamp(0.78rem,2.7vw,1.125rem)] font-semibold uppercase tracking-[0.24em] text-amber-200 sm:tracking-[0.34em]">
            Property search
          </p>
          <h1
            className="mx-auto mt-3 max-w-3xl text-[clamp(1.55rem,7.2vw,3rem)] font-semibold leading-tight tracking-tight text-amber-50 sm:mt-4"
            style={{
              WebkitTextStroke: "0.65px rgba(214, 171, 76, 0.48)",
              textShadow:
                "0 3px 18px rgba(0, 0, 0, 0.72), 0 1px 2px rgba(92, 61, 7, 0.58), 0 0 22px rgba(214, 171, 76, 0.18)"
            }}
          >
            Discover verified homes and commercial spaces without the hassle of property hunting. We&apos;re available in your
            locality
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[clamp(0.82rem,3.4vw,0.95rem)] leading-6 text-stone-100 sm:mt-5 sm:leading-7">
            Built for mobile-first browsing, low bandwidth, and fast contact with verified agents.
          </p>
        </div>
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

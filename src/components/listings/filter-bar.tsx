"use client";

import { FormEvent, useState } from "react";

import { LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { ListingCategory, PropertyType } from "@/lib/types";

export type FilterBarProps = {
  initialKeyword?: string;
  initialState?: string;
  initialCity?: string;
  initialMinPrice?: number;
  initialMaxPrice?: number;
  initialBedrooms?: number;
  initialBathrooms?: number;
  initialType?: string;
  initialCategory?: string;
  variant?: "hero" | "side";
};

type FilterTab = {
  label: string;
  listingCategory?: ListingCategory;
  propertyType?: PropertyType;
};

const tabs: FilterTab[] = [
  { label: "Buy", listingCategory: "for_sale" },
  { label: "Rent", listingCategory: "for_rent" },
  { label: "Short Let", listingCategory: "short_let" },
  { label: "Land", propertyType: "land" }
];

const propertyTypeOptions: Array<{ value: PropertyType; label: string }> = [
  { value: "apartment", label: "Apartment" },
  { value: "duplex", label: "Duplex" },
  { value: "land", label: "Land" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop" }
];

function getInitialTab(category?: string, propertyType?: string) {
  if (propertyType === "land") {
    return "Land";
  }

  return tabs.find((tab) => tab.listingCategory === category)?.label ?? "Buy";
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-[2.4]">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function SelectChevron({ isSide }: { isSide: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current stroke-2 ${
        isSide ? "right-1" : "right-1 md:right-3"
      }`}
    >
      <path d="m5 7 5 5 5-5" />
    </svg>
  );
}

export function FilterBar({
  initialKeyword,
  initialState,
  initialCity,
  initialMinPrice,
  initialMaxPrice,
  initialBedrooms,
  initialBathrooms,
  initialType,
  initialCategory,
  variant = "hero"
}: FilterBarProps) {
  const isSide = variant === "side";
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [state, setState] = useState(initialState ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [minPrice, setMinPrice] = useState(initialMinPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice?.toString() ?? "");
  const [bedrooms, setBedrooms] = useState(initialBedrooms?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(initialBathrooms?.toString() ?? "");
  const [propertyType, setPropertyType] = useState(initialType ?? "");
  const [listingCategory, setListingCategory] = useState(initialCategory ?? "");
  const [activeTab, setActiveTab] = useState(getInitialTab(initialCategory, initialType));
  const [showMoreFilters, setShowMoreFilters] = useState(
    Boolean(initialCategory || initialMinPrice || initialMaxPrice || initialBedrooms || initialBathrooms)
  );

  const lgas = getLgasForState(state);
  const hasActiveFilters = Boolean(
    keyword.trim() ||
      state ||
      city ||
      minPrice ||
      maxPrice ||
      bedrooms ||
      bathrooms ||
      propertyType ||
      listingCategory
  );

  function applyTab(tab: FilterTab) {
    setActiveTab(tab.label);

    if (tab.propertyType === "land") {
      setPropertyType("land");
      setListingCategory("");
      return;
    }

    setListingCategory(tab.listingCategory ?? "");
    if (propertyType === "land") {
      setPropertyType("");
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (keyword.trim()) params.set("q", keyword.trim());
    if (state) params.set("state", state);
    if (city) params.set("city", city);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (bathrooms) params.set("bathrooms", bathrooms);
    if (propertyType) params.set("propertyType", propertyType);
    if (listingCategory) params.set("listingCategory", listingCategory);

    window.location.href = params.toString() ? `/?${params.toString()}#search-results` : "/#search-results";
  }

  function clearFilters() {
    window.location.href = "/#search-results";
  }

  const selectClass = isSide
    ? "w-full cursor-pointer appearance-none bg-transparent py-2.5 pr-7 text-sm font-bold text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400 [&>option]:bg-white [&>option]:text-slate-950"
    : "w-full min-w-0 cursor-pointer appearance-none overflow-hidden text-ellipsis whitespace-nowrap bg-transparent py-3 pr-8 text-sm font-bold text-white outline-none disabled:cursor-not-allowed disabled:text-white/55 md:py-2.5 [&>option]:bg-white [&>option]:text-slate-950";
  const fieldWrapClass = isSide
    ? "relative cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 text-slate-900 shadow-sm"
    : "relative min-w-0 cursor-pointer border-b border-white/70 px-2 text-white md:rounded-2xl md:border md:border-white/35 md:bg-slate-950/20 md:px-3 md:shadow-sm md:backdrop-blur-sm";
  const advancedFieldWrapClass = `${fieldWrapClass} ${isSide || showMoreFilters ? "block" : "hidden md:block"}`;
  const priceInputClass = isSide
    ? "w-full bg-transparent py-2.5 text-sm font-bold text-slate-900 outline-none placeholder:text-slate-500"
    : "w-full min-w-0 bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-white md:py-2.5";

  return (
    <form
      onSubmit={onSubmit}
      className={
        isSide
          ? "w-full overflow-hidden rounded-[1.35rem] bg-slate-50 p-3"
          : "w-full overflow-hidden bg-transparent p-0 md:rounded-[1.5rem] md:bg-white/15 md:px-5 md:py-5"
      }
    >
      <div
        className={
          isSide
            ? "grid grid-cols-2 gap-2 text-center text-xs font-black uppercase tracking-[0.08em] text-slate-700"
            : "grid grid-cols-3 border-b border-white/55 text-center text-sm font-bold text-white md:grid-cols-4 md:border-white/45 md:text-base"
        }
      >
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={
              isSide
                ? `relative cursor-pointer rounded-2xl border px-3 py-2.5 transition ${
                    activeTab === tab.label
                      ? "border-amber-300 bg-amber-100 text-slate-950"
                      : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:text-teal-800"
                  }`
                : `relative cursor-pointer px-2 pb-3 pt-0 transition md:px-6 md:pb-4 md:pt-5 ${
                    activeTab === tab.label ? "text-amber-100" : "text-white"
                  } ${tab.label === "Short Let" ? "hidden md:block" : ""}`
            }
            onClick={() => applyTab(tab)}
          >
            {tab.label}
            {!isSide ? (
              <span
                className={`absolute bottom-0 left-1/2 h-[2px] w-24 max-w-[80%] -translate-x-1/2 rounded-full transition ${
                  activeTab === tab.label ? "bg-amber-200" : "bg-transparent"
                }`}
              />
            ) : null}
          </button>
        ))}
      </div>

      <div className={isSide ? "mt-3 flex flex-col gap-3" : "mt-8 flex flex-col gap-4 md:mt-4"}>
        <div className={isSide ? "grid gap-3" : "flex flex-col gap-4 md:flex-row md:gap-0"}>
          <label
            className={
              isSide
                ? "relative flex min-h-12 flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm"
                : "relative flex min-h-14 flex-1 items-center rounded-md border border-[#080f3d] bg-white px-4 text-[#080f3d] md:rounded-l-xl md:rounded-r-none md:px-5"
            }
          >
            <SearchIcon />
            <input
              aria-label="Search listings"
              className="ml-3 w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 md:text-base"
              placeholder="search sale"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <button
            className={
              isSide
                ? "min-h-11 cursor-pointer rounded-2xl bg-[#430078] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#530096]"
                : "hidden min-h-10 cursor-pointer rounded-md bg-[#430078] px-8 text-sm font-bold text-white shadow-sm md:block md:min-h-14 md:rounded-l-none md:rounded-r-xl md:px-10 md:text-base"
            }
          >
            Search
          </button>
        </div>

        <div
          className={
            isSide
              ? "grid gap-3"
              : "grid grid-cols-2 gap-x-4 gap-y-4 pb-2 md:grid-cols-4 md:gap-3 md:pb-0 2xl:grid-cols-8"
          }
        >
          <label className={fieldWrapClass}>
            <span className="sr-only">Property type</span>
            <select
              className={selectClass}
              value={propertyType}
              onChange={(event) => {
                const nextType = event.target.value;
                setPropertyType(nextType);
                if (nextType === "land") {
                  setActiveTab("Land");
                  setListingCategory("");
                }
              }}
            >
              <option value="">Type</option>
              {propertyTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SelectChevron isSide={isSide} />
          </label>

          <label className={fieldWrapClass}>
            <span className="sr-only">State</span>
            <select
              className={selectClass}
              value={state}
              onChange={(event) => {
                setState(event.target.value);
                setCity("");
              }}
            >
              <option value="">State</option>
              {NIGERIA_STATES.map((stateOption) => (
                <option key={stateOption} value={stateOption}>
                  {stateOption}
                </option>
              ))}
            </select>
            <SelectChevron isSide={isSide} />
          </label>

          <label className={fieldWrapClass}>
            <span className="sr-only">LGA</span>
            <select
              className={selectClass}
              value={city}
              disabled={!state}
              onChange={(event) => setCity(event.target.value)}
            >
              <option value="">{state ? "Select city" : "Select state"}</option>
              {lgas.map((lga) => (
                <option key={lga} value={lga}>
                  {lga}
                </option>
              ))}
            </select>
            <SelectChevron isSide={isSide} />
          </label>

          <label className={advancedFieldWrapClass}>
            <span className="sr-only">Listing category</span>
            <select
              className={selectClass}
              value={listingCategory}
              onChange={(event) => {
                const nextCategory = event.target.value;
                setListingCategory(nextCategory);
                const matchingTab = tabs.find((tab) => tab.listingCategory === nextCategory);
                if (matchingTab) {
                  setActiveTab(matchingTab.label);
                }
              }}
            >
              <option value="">Category</option>
              {Object.entries(LISTING_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <SelectChevron isSide={isSide} />
          </label>

          <label className={advancedFieldWrapClass}>
            <span className="sr-only">Bedrooms</span>
            <select className={selectClass} value={bedrooms} onChange={(event) => setBedrooms(event.target.value)}>
              <option value="">Bedrooms</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                <option key={value} value={value}>
                  {value}+ Beds
                </option>
              ))}
            </select>
            <SelectChevron isSide={isSide} />
          </label>

          <label className={advancedFieldWrapClass}>
            <span className="sr-only">Bathrooms</span>
            <select className={selectClass} value={bathrooms} onChange={(event) => setBathrooms(event.target.value)}>
              <option value="">Bathrooms</option>
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}+ Baths
                </option>
              ))}
            </select>
            <SelectChevron isSide={isSide} />
          </label>

          <label className={advancedFieldWrapClass}>
            <span className="sr-only">Minimum price</span>
            <input
              className={priceInputClass}
              inputMode="numeric"
              placeholder="Min. Price"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
          </label>

          <label className={advancedFieldWrapClass}>
            <span className="sr-only">Maximum price</span>
            <input
              className={priceInputClass}
              inputMode="numeric"
              placeholder="Max. Price"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </label>
        </div>
        <div className={isSide ? "flex flex-col gap-2" : "flex flex-col gap-2 md:flex-row md:items-center md:justify-between"}>
          <div className={isSide ? "hidden" : "flex gap-2 md:hidden"}>
            <button
              className="flex-1 rounded-md border border-white/60 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              type="button"
              onClick={() => setShowMoreFilters((current) => !current)}
            >
              {showMoreFilters ? "Hide filters" : "More filters"}
            </button>
            {hasActiveFilters ? (
              <button
                className="rounded-md border border-white/60 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                type="button"
                onClick={clearFilters}
              >
                Clear
              </button>
            ) : null}
          </div>
          {hasActiveFilters ? (
            <button
              className={
                isSide
                  ? "rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-white"
                  : "hidden rounded-md border border-white/50 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 md:inline-flex"
              }
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : <span className={isSide ? "hidden" : "hidden md:block"} />}
          <button className={isSide ? "hidden" : "min-h-10 cursor-pointer rounded-md bg-[#430078] px-8 text-sm font-bold text-white shadow-sm md:hidden"}>
            Search
          </button>
        </div>
      </div>
      {!isSide ? <div className="mt-6 hidden h-px w-full bg-white/40 md:block" aria-hidden="true" /> : null}
    </form>
  );
}

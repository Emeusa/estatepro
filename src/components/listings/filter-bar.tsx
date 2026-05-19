"use client";

import { FormEvent, useState } from "react";

import { LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { ListingCategory, PropertyType } from "@/lib/types";

type Props = {
  initialKeyword?: string;
  initialState?: string;
  initialCity?: string;
  initialMinPrice?: number;
  initialMaxPrice?: number;
  initialType?: string;
  initialCategory?: string;
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

function SelectChevron() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 fill-none stroke-current stroke-2 md:right-0">
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
  initialType,
  initialCategory
}: Props) {
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [state, setState] = useState(initialState ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [minPrice, setMinPrice] = useState(initialMinPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice?.toString() ?? "");
  const [propertyType, setPropertyType] = useState(initialType ?? "");
  const [listingCategory, setListingCategory] = useState(initialCategory ?? "");
  const [activeTab, setActiveTab] = useState(getInitialTab(initialCategory, initialType));

  const lgas = getLgasForState(state);

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
    if (propertyType) params.set("propertyType", propertyType);
    if (listingCategory) params.set("listingCategory", listingCategory);

    window.location.href = params.toString() ? `/?${params.toString()}#search-results` : "/#search-results";
  }

  const selectClass =
    "w-full cursor-pointer appearance-none bg-transparent py-3 pr-6 text-sm font-bold text-white outline-none disabled:cursor-not-allowed disabled:text-white/55 md:py-2 [&>option]:bg-white [&>option]:text-slate-950";
  const fieldWrapClass =
    "relative cursor-pointer border-b border-white/70 px-2 text-white md:border-b-0 md:border-r md:border-white/45 md:px-4 last:md:border-r-0";

  return (
    <form
      onSubmit={onSubmit}
      className="w-full overflow-hidden bg-transparent p-0 md:rounded-[1.5rem] md:bg-white/15 md:px-5 md:py-5"
    >
      <div className="grid grid-cols-3 border-b border-white/55 text-center text-sm font-bold text-white md:grid-cols-4 md:border-white/45 md:text-base">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            className={`relative cursor-pointer px-2 pb-3 pt-0 transition md:px-6 md:pb-4 md:pt-5 ${
              activeTab === tab.label ? "text-amber-100" : "text-white"
            } ${tab.label === "Short Let" ? "hidden md:block" : ""}`}
            onClick={() => applyTab(tab)}
          >
            {tab.label}
            <span
              className={`absolute bottom-0 left-1/2 h-[2px] w-24 max-w-[80%] -translate-x-1/2 rounded-full transition ${
                activeTab === tab.label ? "bg-amber-200" : "bg-transparent"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4 md:mt-4">
        <div className="flex flex-col gap-4 md:flex-row md:gap-0">
          <label className="relative flex min-h-14 flex-1 items-center rounded-md border border-[#080f3d] bg-white px-4 text-[#080f3d] md:rounded-l-xl md:rounded-r-none md:px-5">
            <SearchIcon />
            <input
              aria-label="Search listings"
              className="ml-3 w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 md:text-base"
              placeholder="search sale"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <button className="hidden min-h-10 cursor-pointer rounded-md bg-[#430078] px-8 text-sm font-bold text-white shadow-sm md:block md:min-h-14 md:rounded-l-none md:rounded-r-xl md:px-10 md:text-base">
            Search
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4 pb-2 md:flex md:justify-center md:gap-0 md:pb-0">
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
            <SelectChevron />
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
            <SelectChevron />
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
            <SelectChevron />
          </label>

          <label className={fieldWrapClass}>
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
            <SelectChevron />
          </label>

          <label className={fieldWrapClass}>
            <span className="sr-only">Minimum price</span>
            <input
              className="w-full bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-white md:py-2"
              inputMode="numeric"
              placeholder="Min. Price"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
            />
          </label>

          <label className={fieldWrapClass}>
            <span className="sr-only">Maximum price</span>
            <input
              className="w-full bg-transparent py-3 text-sm font-bold text-white outline-none placeholder:text-white md:py-2"
              inputMode="numeric"
              placeholder="Max. Price"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
            />
          </label>
        </div>
        <button className="min-h-10 cursor-pointer rounded-md bg-[#430078] px-8 text-sm font-bold text-white shadow-sm md:hidden">
          Search
        </button>
      </div>
      <div className="mt-6 hidden h-px w-full bg-white/40 md:block" aria-hidden="true" />
    </form>
  );
}

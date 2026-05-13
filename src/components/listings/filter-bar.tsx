"use client";

import { FormEvent, useState } from "react";

import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";

type Props = {
  initialKeyword?: string;
  initialState?: string;
  initialCity?: string;
  initialMaxPrice?: number;
  initialType?: string;
};

export function FilterBar({ initialKeyword, initialState, initialCity, initialMaxPrice, initialType }: Props) {
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [state, setState] = useState(initialState ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice?.toString() ?? "");
  const [propertyType, setPropertyType] = useState(initialType ?? "");

  const lgas = getLgasForState(state);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (keyword) params.set("q", keyword);
    if (state) params.set("state", state);
    if (city) params.set("city", city);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (propertyType) params.set("propertyType", propertyType);

    window.location.href = `/?${params.toString()}`;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm md:grid-cols-6">
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0 md:col-span-2"
        placeholder="Search by title, category, or keyword"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <select
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0"
        value={state}
        onChange={(event) => {
          setState(event.target.value);
          setCity("");
        }}
      >
        <option value="">Any state</option>
        {NIGERIA_STATES.map((stateOption) => (
          <option key={stateOption} value={stateOption}>
            {stateOption}
          </option>
        ))}
      </select>
      <select
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0"
        value={city}
        disabled={!state}
        onChange={(event) => setCity(event.target.value)}
      >
        <option value="">{state ? "Any LGA" : "Select state first"}</option>
        {lgas.map((lga) => (
          <option key={lga} value={lga}>
            {lga}
          </option>
        ))}
      </select>
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0"
        placeholder="Max price in NGN"
        inputMode="numeric"
        value={maxPrice}
        onChange={(event) => setMaxPrice(event.target.value)}
      />
      <select
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0"
        value={propertyType}
        onChange={(event) => setPropertyType(event.target.value)}
      >
        <option value="">Any type</option>
        <option value="apartment">Apartment</option>
        <option value="duplex">Duplex</option>
        <option value="land">Land</option>
        <option value="office">Office</option>
        <option value="shop">Shop</option>
      </select>
      <div className="flex justify-center md:col-span-6">
        <button className="min-w-44 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-medium text-white">
          Apply filters
        </button>
      </div>
    </form>
  );
}

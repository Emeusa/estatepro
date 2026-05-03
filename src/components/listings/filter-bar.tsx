"use client";

import { FormEvent, useState } from "react";

type Props = {
  initialLocation?: string;
  initialMaxPrice?: number;
  initialType?: string;
};

export function FilterBar({ initialLocation, initialMaxPrice, initialType }: Props) {
  const [location, setLocation] = useState(initialLocation ?? "");
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice?.toString() ?? "");
  const [propertyType, setPropertyType] = useState(initialType ?? "");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (location) params.set("location", location);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (propertyType) params.set("propertyType", propertyType);

    window.location.href = `/?${params.toString()}`;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-white p-4 shadow-sm md:grid-cols-4">
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-0"
        placeholder="lagos-ikeja-alausa"
        value={location}
        onChange={(event) => setLocation(event.target.value)}
      />
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
      <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white">
        Apply filters
      </button>
    </form>
  );
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { ApiRequestError, apiRequest } from "@/lib/api";
import { AVAILABILITY_LABELS, CATEGORY_AVAILABILITY, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { ListingCategory, ListingRecord } from "@/lib/types";
import { uploadListingImages } from "@/lib/uploads";

type Props = {
  token: string;
  listing?: ListingRecord;
  onSaved?: (listing: ListingRecord) => void;
};

export function ListingForm({ token, listing, onSaved }: Props) {
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedState, setSelectedState] = useState(listing?.location.state ?? "");
  const [selectedLga, setSelectedLga] = useState(listing?.location.city ?? "");
  const [listingCategory, setListingCategory] = useState<ListingCategory>(listing?.listingCategory ?? "for_sale");
  const [availability, setAvailability] = useState(listing?.availability ?? "available");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadThumbnailIndex, setUploadThumbnailIndex] = useState(0);
  const [existingThumbnailIndex, setExistingThumbnailIndex] = useState(0);

  const lgas = getLgasForState(selectedState);
  const cityOptions = selectedLga && !lgas.includes(selectedLga) ? [selectedLga, ...lgas] : lgas;
  const availabilityOptions = CATEGORY_AVAILABILITY[listingCategory];
  const formKey = listing?.id ?? "new-listing";

  useEffect(() => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    setUploadThumbnailIndex(0);
    setExistingThumbnailIndex(0);
    setSelectedState(listing?.location.state ?? "");
    setSelectedLga(listing?.location.city ?? "");
    setListingCategory(listing?.listingCategory ?? "for_sale");
    setAvailability(listing?.availability ?? "available");
  }, [listing]);

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  function moveToFront<T>(items: T[], index: number) {
    if (index <= 0 || index >= items.length) {
      return items;
    }

    return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 12);
    setSelectedFiles(files);
    setUploadThumbnailIndex(0);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.images;
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setFieldErrors({});
    setIsSubmitting(true);
    const form = new FormData(formElement);
    const imageFiles = selectedFiles.filter((file) => file.size > 0);
    const orderedExistingImages = moveToFront(listing?.imageUrls ?? [], existingThumbnailIndex);
    const payload = {
      title: form.get("title"),
      description: form.get("description"),
      price: Number(form.get("price")),
      propertyType: form.get("propertyType"),
      listingCategory: form.get("listingCategory"),
      availability: form.get("availability"),
      imageUrls: orderedExistingImages,
      contactPhone: form.get("contactPhone"),
      contactWhatsapp: form.get("contactWhatsapp"),
      location: {
        state: form.get("state"),
        city: form.get("city"),
        area: form.get("area")
      }
    };

    try {
      if (imageFiles.length) {
        try {
          payload.imageUrls = await uploadListingImages(moveToFront(imageFiles, uploadThumbnailIndex));
        } catch (error) {
          setFieldErrors({ images: "Image upload failed. Supabase Storage may not be configured yet." });
          setMessage(error instanceof Error ? error.message : "Image upload failed.");
          return;
        }
      }
      const response = await apiRequest<{ listing: ListingRecord }>(
        listing ? `/api/listings/${listing.id}` : "/api/listings",
        {
          method: listing ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload)
        }
      );
      onSaved?.(response.listing);
      setMessage(listing ? "Listing updated." : "Listing submitted for review.");
      setFieldErrors({});
      if (!listing) {
        formElement.reset();
        setSelectedFiles([]);
        setPreviewUrls([]);
        setUploadThumbnailIndex(0);
        setExistingThumbnailIndex(0);
        setSelectedState("");
        setSelectedLga("");
        setListingCategory("for_sale");
        setAvailability("available");
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        setFieldErrors(error.fields);
        setMessage(error.message);
        return;
      }
      setMessage(error instanceof Error ? error.message : "Listing request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form key={formKey} onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-white p-5 shadow-sm">
      <div>
        <input className="input" name="title" defaultValue={listing?.title} placeholder="Listing title" />
        {fieldErrors.title ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.title}</p> : null}
      </div>
      <textarea
        className="input min-h-32"
        name="description"
        defaultValue={listing?.description}
        placeholder="Describe the property"
      />
      {fieldErrors.description ? <p className="-mt-1 text-sm text-rose-600">{fieldErrors.description}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <input className="input" name="price" type="number" defaultValue={listing?.price} placeholder="Price" />
          {fieldErrors.price ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.price}</p> : null}
        </div>
        <div>
          <select className="input" name="propertyType" defaultValue={listing?.propertyType}>
            <option value="apartment">Apartment</option>
            <option value="duplex">Duplex</option>
            <option value="land">Land</option>
            <option value="office">Office</option>
            <option value="shop">Shop</option>
          </select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="input"
          name="listingCategory"
          value={listingCategory}
          onChange={(event) => {
            const nextCategory = event.target.value as ListingCategory;
            setListingCategory(nextCategory);
            setAvailability("available");
          }}
        >
          {Object.entries(LISTING_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="input"
          name="availability"
          value={availability}
          onChange={(event) => setAvailability(event.target.value as typeof availability)}
        >
          {availabilityOptions.map((value) => (
            <option key={value} value={value}>
              {AVAILABILITY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <input className="input" name="images" type="file" multiple accept="image/*" onChange={onImageChange} />
        {fieldErrors.images ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.images}</p> : null}
      </div>
      {previewUrls.length ? (
        <div className="rounded-2xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-950">Choose upload thumbnail</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {previewUrls.map((url, index) => (
              <button
                key={url}
                type="button"
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  uploadThumbnailIndex === index ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"
                }`}
                onClick={() => setUploadThumbnailIndex(index)}
              >
                <span
                  aria-hidden="true"
                  className="block h-28 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${url}")` }}
                />
                <span className="block px-3 py-2 text-xs font-medium text-slate-600">
                  {uploadThumbnailIndex === index ? "Thumbnail selected" : "Use as thumbnail"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : listing?.imageUrls.length ? (
        <div className="rounded-2xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-950">Current listing thumbnail</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {listing.imageUrls.map((imageUrl, index) => (
              <button
                key={imageUrl}
                type="button"
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  existingThumbnailIndex === index ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"
                }`}
                onClick={() => setExistingThumbnailIndex(index)}
              >
                <span
                  aria-hidden="true"
                  className="block h-28 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${imageUrl}")` }}
                />
                <span className="block px-3 py-2 text-xs font-medium text-slate-600">
                  {existingThumbnailIndex === index ? "Thumbnail selected" : "Use as thumbnail"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <input className="input" name="contactPhone" defaultValue={listing?.contactPhone} placeholder="Contact phone" />
          {fieldErrors.contactPhone ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.contactPhone}</p> : null}
        </div>
        <div>
          <input
            className="input"
            name="contactWhatsapp"
            defaultValue={listing?.contactWhatsapp}
            placeholder="WhatsApp number"
          />
          {fieldErrors.contactWhatsapp ? (
            <p className="mt-1 text-sm text-rose-600">{fieldErrors.contactWhatsapp}</p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <select
            className="input"
            name="state"
            value={selectedState}
            onChange={(event) => {
              setSelectedState(event.target.value);
              setSelectedLga("");
            }}
          >
            <option value="">Select state</option>
            {NIGERIA_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {fieldErrors.state ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.state}</p> : null}
        </div>
        <div>
          <select
            className="input"
            name="city"
            value={selectedLga}
            disabled={!selectedState}
            onChange={(event) => setSelectedLga(event.target.value)}
          >
            <option value="">{selectedState ? "Select LGA" : "Select state first"}</option>
            {cityOptions.map((lga) => (
              <option key={lga} value={lga}>
                {lga}
              </option>
            ))}
          </select>
          {fieldErrors.city ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.city}</p> : null}
        </div>
        <div>
          <input className="input" name="area" defaultValue={listing?.location.area} placeholder="Area" />
          {fieldErrors.area ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.area}</p> : null}
        </div>
      </div>
      <button className="button-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save listing"}
      </button>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}
    </form>
  );
}

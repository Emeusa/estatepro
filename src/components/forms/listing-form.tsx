"use client";

import { FormEvent, useState } from "react";

import { ApiRequestError, apiRequest } from "@/lib/api";
import { ListingRecord } from "@/lib/types";
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setFieldErrors({});
    setIsSubmitting(true);
    const form = new FormData(formElement);
    const imageFiles = form.getAll("images").filter(
      (value): value is File => value instanceof File && value.size > 0
    );
    const payload = {
      title: form.get("title"),
      description: form.get("description"),
      price: Number(form.get("price")),
      propertyType: form.get("propertyType"),
      imageUrls: listing?.imageUrls ?? [],
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
          payload.imageUrls = await uploadListingImages(imageFiles);
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
    <form onSubmit={onSubmit} className="grid gap-3 rounded-3xl bg-white p-5 shadow-sm">
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
      <div>
        <input className="input" name="images" type="file" multiple accept="image/*" />
        {fieldErrors.images ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.images}</p> : null}
      </div>
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
          <input className="input" name="state" defaultValue={listing?.location.state} placeholder="State" />
          {fieldErrors.state ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.state}</p> : null}
        </div>
        <div>
          <input className="input" name="city" defaultValue={listing?.location.city} placeholder="City" />
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

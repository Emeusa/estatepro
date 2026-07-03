"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { ApiRequestError, apiRequest } from "@/lib/api";
import {
  isSupportedListingImageType,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  SUPPORTED_LISTING_IMAGE_ACCEPT,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { getListingImages, reorderListingImageVariants } from "@/lib/listing-images";
import { AVAILABILITY_LABELS, CATEGORY_AVAILABILITY, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import {
  FURNISHING_STATUS_LABELS,
  FURNISHING_STATUSES,
  LAND_SIZE_UNIT_LABELS,
  LAND_SIZE_UNITS,
  PROPERTY_CONDITION_LABELS,
  PROPERTY_CONDITIONS,
  PROPERTY_SIZE_UNIT_LABELS,
  PROPERTY_SIZE_UNITS,
  ROAD_ACCESS_LABELS,
  ROAD_ACCESS_TYPES,
  SERVICING_STATUS_LABELS,
  SERVICING_STATUSES,
  TITLE_DOCUMENT_TYPE_LABELS,
  TITLE_DOCUMENT_TYPES,
  ZONING_TYPE_LABELS,
  ZONING_TYPES
} from "@/lib/listing-quality";
import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { ListingCategory, ListingImageVariant, ListingRecord } from "@/lib/types";
import { uploadListingImages } from "@/lib/uploads";
import { TurnstileFields, readBotFields } from "@/components/security/turnstile-fields";

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
  const existingImages = listing ? getListingImages(listing) : [];

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

  function optionalNumber(form: FormData, name: string) {
    const value = form.get(name)?.toString().trim();
    return value ? Number(value) : null;
  }

  function optionalString(form: FormData, name: string) {
    return form.get(name)?.toString().trim() || null;
  }

  function arrayValue(values: string[]) {
    return values.join(", ");
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const unsupportedFile = files.find((file) => !isSupportedListingImageType(file.type));
    const oversizedFile = files.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);

    if (unsupportedFile) {
      event.target.value = "";
      setSelectedFiles([]);
      setPreviewUrls([]);
      setUploadThumbnailIndex(0);
      setFieldErrors((current) => ({
        ...current,
        images: `Only ${SUPPORTED_LISTING_IMAGE_LABEL} images are supported.`
      }));
      return;
    }

    if (oversizedFile) {
      event.target.value = "";
      setSelectedFiles([]);
      setPreviewUrls([]);
      setUploadThumbnailIndex(0);
      setFieldErrors((current) => ({
        ...current,
        images: `Each property image must be ${MAX_LISTING_IMAGE_MB} MB or less.`
      }));
      return;
    }

    const acceptedFiles = files.slice(0, MAX_LISTING_IMAGES);
    setUploadThumbnailIndex(0);
    setFieldErrors((current) => {
      const next = { ...current };
      if (files.length > MAX_LISTING_IMAGES) {
        next.images = `Only the first ${MAX_LISTING_IMAGES} images will be uploaded.`;
      } else {
        delete next.images;
      }
      return next;
    });
    setSelectedFiles(acceptedFiles);
  }

  function getUploadFailureMessage(error: unknown) {
    if (!(error instanceof Error)) {
      return "Image upload failed. Please try again.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("logged in") || message.includes("session") || message.includes("jwt")) {
      return "Your session expired. Log in again before uploading images.";
    }

    if (message.includes("bucket") || message.includes("not found")) {
      return 'Storage bucket "listing-images" is not configured. Run the Supabase schema.';
    }

    if (
      message.includes("row-level security") ||
      message.includes("rls") ||
      message.includes("policy") ||
      message.includes("permission") ||
      message.includes("unauthorized")
    ) {
      return "Storage upload is blocked by Supabase policy. Run the latest storage policies.";
    }

    if (message.includes("mime") || message.includes("type") || message.includes("format") || message.includes("not allowed")) {
      return `This image format is not supported. Use ${SUPPORTED_LISTING_IMAGE_LABEL}.`;
    }

    if (message.includes("size") || message.includes("too large")) {
      return `Each property image must be ${MAX_LISTING_IMAGE_MB} MB or less.`;
    }

    return error.message;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setFieldErrors({});
    setIsSubmitting(true);
    const form = new FormData(formElement);
    const botFields = readBotFields(form);
    const imageFiles = selectedFiles.filter((file) => file.size > 0);
    const orderedExistingVariants = listing?.imageVariants.length
      ? reorderListingImageVariants(moveToFront(listing.imageVariants, existingThumbnailIndex).slice(0, MAX_LISTING_IMAGES))
      : [];
    const orderedExistingImages = orderedExistingVariants.length
      ? orderedExistingVariants.map((image) => image.heroUrl)
      : moveToFront(listing?.imageUrls ?? [], existingThumbnailIndex).slice(0, MAX_LISTING_IMAGES);
    const payload: Record<string, unknown> & {
      imageUrls: string[];
      imageVariants: ListingImageVariant[];
    } = {
      title: form.get("title"),
      description: form.get("description"),
      price: Number(form.get("price")),
      propertyType: form.get("propertyType"),
      listingCategory: form.get("listingCategory"),
      availability: form.get("availability"),
      imageUrls: orderedExistingImages,
      imageVariants: orderedExistingVariants,
      contactPhone: form.get("contactPhone"),
      contactWhatsapp: form.get("contactWhatsapp"),
      location: {
        state: form.get("state"),
        city: form.get("city"),
        area: form.get("area")
      },
      bedrooms: optionalNumber(form, "bedrooms"),
      bathrooms: optionalNumber(form, "bathrooms"),
      toilets: optionalNumber(form, "toilets"),
      parkingSpaces: optionalNumber(form, "parkingSpaces"),
      propertySize: optionalNumber(form, "propertySize"),
      propertySizeUnit: optionalString(form, "propertySizeUnit"),
      yearBuilt: optionalNumber(form, "yearBuilt"),
      floorLevel: optionalNumber(form, "floorLevel"),
      totalFloors: optionalNumber(form, "totalFloors"),
      furnishingStatus: optionalString(form, "furnishingStatus"),
      servicingStatus: optionalString(form, "servicingStatus"),
      propertyCondition: optionalString(form, "propertyCondition"),
      amenities: form.get("amenities")?.toString() ?? "",
      utilities: form.get("utilities")?.toString() ?? "",
      safetyFeatures: form.get("safetyFeatures")?.toString() ?? "",
      nearbyLandmarks: form.get("nearbyLandmarks")?.toString() ?? "",
      extraFeatures: form.get("extraFeatures")?.toString() ?? "",
      landSize: optionalNumber(form, "landSize"),
      landSizeUnit: optionalString(form, "landSizeUnit"),
      titleDocumentType: optionalString(form, "titleDocumentType"),
      zoningType: optionalString(form, "zoningType"),
      roadAccess: optionalString(form, "roadAccess"),
      ...botFields
    };

    try {
      if (imageFiles.length) {
        try {
          const uploadedImages = await uploadListingImages(moveToFront(imageFiles, uploadThumbnailIndex), token);
          payload.imageVariants = uploadedImages;
          payload.imageUrls = uploadedImages.map((image) => image.heroUrl);
        } catch (error) {
          const uploadMessage = getUploadFailureMessage(error);
          setFieldErrors({ images: uploadMessage });
          setMessage(uploadMessage);
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
    <form key={formKey} onSubmit={onSubmit} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
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
      <fieldset className="rounded-2xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Rooms</legend>
        {fieldErrors.quality ? <p className="mb-2 text-sm text-rose-600">{fieldErrors.quality}</p> : null}
        <div className="grid gap-3 md:grid-cols-4">
          <input className="input" name="bedrooms" type="number" min={1} defaultValue={listing?.bedrooms ?? ""} placeholder="Bedrooms" />
          <input className="input" name="bathrooms" type="number" min={1} defaultValue={listing?.bathrooms ?? ""} placeholder="Bathrooms" />
          <input className="input" name="toilets" type="number" min={1} defaultValue={listing?.toilets ?? ""} placeholder="Toilets" />
          <input className="input" name="parkingSpaces" type="number" min={1} defaultValue={listing?.parkingSpaces ?? ""} placeholder="Parking spaces" />
        </div>
      </fieldset>
      <fieldset className="rounded-2xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Building details</legend>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="propertySize" type="number" min={1} defaultValue={listing?.propertySize ?? ""} placeholder="Property size" />
          <select className="input" name="propertySizeUnit" defaultValue={listing?.propertySizeUnit ?? ""}>
            <option value="">Size unit</option>
            {PROPERTY_SIZE_UNITS.map((value) => (
              <option key={value} value={value}>{PROPERTY_SIZE_UNIT_LABELS[value]}</option>
            ))}
          </select>
          <input className="input" name="yearBuilt" type="number" min={1800} defaultValue={listing?.yearBuilt ?? ""} placeholder="Year built" />
          <input className="input" name="floorLevel" type="number" min={1} defaultValue={listing?.floorLevel ?? ""} placeholder="Floor level" />
          <input className="input" name="totalFloors" type="number" min={1} defaultValue={listing?.totalFloors ?? ""} placeholder="Total floors" />
        </div>
      </fieldset>
      <fieldset className="rounded-2xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Condition</legend>
        <div className="grid gap-3 md:grid-cols-3">
          <select className="input" name="furnishingStatus" defaultValue={listing?.furnishingStatus ?? ""}>
            <option value="">Furnishing</option>
            {FURNISHING_STATUSES.map((value) => (
              <option key={value} value={value}>{FURNISHING_STATUS_LABELS[value]}</option>
            ))}
          </select>
          <select className="input" name="servicingStatus" defaultValue={listing?.servicingStatus ?? ""}>
            <option value="">Servicing</option>
            {SERVICING_STATUSES.map((value) => (
              <option key={value} value={value}>{SERVICING_STATUS_LABELS[value]}</option>
            ))}
          </select>
          <select className="input" name="propertyCondition" defaultValue={listing?.propertyCondition ?? ""}>
            <option value="">Property condition</option>
            {PROPERTY_CONDITIONS.map((value) => (
              <option key={value} value={value}>{PROPERTY_CONDITION_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </fieldset>
      <fieldset className="rounded-2xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Amenities and features</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea className="input min-h-24" name="amenities" defaultValue={arrayValue(listing?.amenities ?? [])} placeholder="Amenities, separated by commas" />
          <textarea className="input min-h-24" name="utilities" defaultValue={arrayValue(listing?.utilities ?? [])} placeholder="Utilities, separated by commas" />
          <textarea className="input min-h-24" name="safetyFeatures" defaultValue={arrayValue(listing?.safetyFeatures ?? [])} placeholder="Safety features, separated by commas" />
          <textarea className="input min-h-24" name="nearbyLandmarks" defaultValue={arrayValue(listing?.nearbyLandmarks ?? [])} placeholder="Nearby landmarks, separated by commas" />
          <textarea className="input min-h-24 md:col-span-2" name="extraFeatures" defaultValue={arrayValue(listing?.extraFeatures ?? [])} placeholder="Extra features, separated by commas" />
        </div>
      </fieldset>
      <fieldset className="rounded-2xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Land and commercial details</legend>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="landSize" type="number" min={1} defaultValue={listing?.landSize ?? ""} placeholder="Land size" />
          <select className="input" name="landSizeUnit" defaultValue={listing?.landSizeUnit ?? ""}>
            <option value="">Land size unit</option>
            {LAND_SIZE_UNITS.map((value) => (
              <option key={value} value={value}>{LAND_SIZE_UNIT_LABELS[value]}</option>
            ))}
          </select>
          <select className="input" name="titleDocumentType" defaultValue={listing?.titleDocumentType ?? ""}>
            <option value="">Title document</option>
            {TITLE_DOCUMENT_TYPES.map((value) => (
              <option key={value} value={value}>{TITLE_DOCUMENT_TYPE_LABELS[value]}</option>
            ))}
          </select>
          <select className="input" name="zoningType" defaultValue={listing?.zoningType ?? ""}>
            <option value="">Zoning</option>
            {ZONING_TYPES.map((value) => (
              <option key={value} value={value}>{ZONING_TYPE_LABELS[value]}</option>
            ))}
          </select>
          <select className="input" name="roadAccess" defaultValue={listing?.roadAccess ?? ""}>
            <option value="">Road access</option>
            {ROAD_ACCESS_TYPES.map((value) => (
              <option key={value} value={value}>{ROAD_ACCESS_LABELS[value]}</option>
            ))}
          </select>
        </div>
      </fieldset>
      <div>
        <input
          className="input"
          name="images"
          type="file"
          multiple
          accept={SUPPORTED_LISTING_IMAGE_ACCEPT}
          onChange={onImageChange}
        />
        <p className="mt-1 text-xs text-slate-500">
          Upload up to {MAX_LISTING_IMAGES} {SUPPORTED_LISTING_IMAGE_LABEL} images. Each image must be{" "}
          {MAX_LISTING_IMAGE_MB} MB or less.
        </p>
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
      ) : existingImages.length ? (
        <div className="rounded-2xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-950">Current listing thumbnail</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {existingImages.map((image, index) => (
              <button
                key={`${image.heroUrl}-${index}`}
                type="button"
                className={`overflow-hidden rounded-2xl border text-left transition ${
                  existingThumbnailIndex === index ? "border-teal-600 ring-2 ring-teal-100" : "border-slate-200"
                }`}
                onClick={() => setExistingThumbnailIndex(index)}
              >
                <span
                  aria-hidden="true"
                  className="block h-28 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url("${image.cardUrl}")` }}
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
      <TurnstileFields />
      <button className="button-primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save listing"}
      </button>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}
    </form>
  );
}

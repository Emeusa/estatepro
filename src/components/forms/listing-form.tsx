"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useState } from "react";

import { ApiRequestError, apiRequest } from "@/lib/api";
import {
  getListingImageFormatErrorMessage,
  getListingImageCountLimitMessage,
  isSupportedListingImageFile,
  MAX_LISTING_IMAGES,
  MAX_LISTING_IMAGE_BYTES,
  MAX_LISTING_IMAGE_MB,
  SUPPORTED_LISTING_IMAGE_LABEL
} from "@/lib/image-limits";
import { getListingImages, reorderListingImageVariants } from "@/lib/listing-images";
import { AVAILABILITY_LABELS, CATEGORY_AVAILABILITY, LISTING_CATEGORY_LABELS } from "@/lib/listing-labels";
import {
  FURNISHING_STATUS_LABELS,
  FURNISHING_STATUSES,
  LAND_SIZE_UNIT_LABELS,
  LAND_SIZE_UNITS,
  LISTING_FEATURE_GROUPS,
  mergeListingFeatureValues,
  PROPERTY_CONDITION_LABELS,
  PROPERTY_CONDITIONS,
  PROPERTY_SIZE_UNIT_LABELS,
  PROPERTY_SIZE_UNITS,
  ROAD_ACCESS_LABELS,
  ROAD_ACCESS_TYPES,
  SERVICING_STATUS_LABELS,
  SERVICING_STATUSES,
  splitListingFeatureValues,
  TITLE_DOCUMENT_TYPE_LABELS,
  TITLE_DOCUMENT_TYPES,
  ZONING_TYPE_LABELS,
  ZONING_TYPES
} from "@/lib/listing-quality";
import { getLgasForState, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { ListingCategory, ListingImageVariant, ListingRecord } from "@/lib/types";
import { normalizeListingImageFile, uploadListingImages } from "@/lib/uploads";

type Props = {
  token: string;
  listing?: ListingRecord;
  onSaved?: (listing: ListingRecord) => void;
};

function OptionalSection({
  title,
  helper,
  defaultOpen = false,
  muted = false,
  children
}: {
  title: string;
  helper: string;
  defaultOpen?: boolean;
  muted?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <details
      className={`rounded-2xl border border-slate-200 bg-slate-50/70 p-3 ${muted ? "opacity-70" : ""}`}
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
            <p className="mt-1 text-xs text-slate-500">{helper}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
            Optional
          </span>
        </div>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function ButtonSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white"
    />
  );
}

export function ListingForm({ token, listing, onSaved }: Props) {
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedState, setSelectedState] = useState(listing?.location.state ?? "");
  const [selectedLga, setSelectedLga] = useState(listing?.location.city ?? "");
  const [propertyType, setPropertyType] = useState(listing?.propertyType ?? "apartment");
  const [listingCategory, setListingCategory] = useState<ListingCategory>(listing?.listingCategory ?? "for_sale");
  const [availability, setAvailability] = useState(listing?.availability ?? "available");
  const [contactPhone, setContactPhone] = useState(listing?.contactPhone ?? "");
  const [contactWhatsapp, setContactWhatsapp] = useState(listing?.contactWhatsapp ?? "");
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(
    listing ? listing.contactPhone === listing.contactWhatsapp : true
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [imageInputKey, setImageInputKey] = useState(0);
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
    setImageInputKey((current) => current + 1);
    setUploadThumbnailIndex(0);
    setExistingThumbnailIndex(0);
    setSelectedState(listing?.location.state ?? "");
    setSelectedLga(listing?.location.city ?? "");
    setPropertyType(listing?.propertyType ?? "apartment");
    setListingCategory(listing?.listingCategory ?? "for_sale");
    setAvailability(listing?.availability ?? "available");
    setContactPhone(listing?.contactPhone ?? "");
    setContactWhatsapp(listing?.contactWhatsapp ?? "");
    setWhatsappSameAsPhone(listing ? listing.contactPhone === listing.contactWhatsapp : true);
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

  function featureValuesFromForm(form: FormData, key: string) {
    const selectedValues = form.getAll(`${key}Selected`).map((value) => value.toString());
    const customText = form.get(`${key}Custom`)?.toString() ?? "";

    return mergeListingFeatureValues(selectedValues, customText);
  }

  function clearImageError() {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.images;
      return next;
    });
  }

  function setImageError(message: string) {
    setFieldErrors((current) => ({
      ...current,
      images: message
    }));
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      setSelectedFiles([]);
      return;
    }

    const countLimitMessage = getListingImageCountLimitMessage(files.length);
    if (countLimitMessage) {
      setSelectedFiles([]);
      setImageInputKey((current) => current + 1);
      setImageError(countLimitMessage);
      return;
    }

    const formatError = files.map(getListingImageFormatErrorMessage).find(Boolean);
    const unsupportedFile = files.find((file) => !isSupportedListingImageFile(file));
    const oversizedFile = files.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);

    if (formatError || unsupportedFile) {
      setSelectedFiles([]);
      setImageInputKey((current) => current + 1);
      setImageError(formatError ?? `This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`);
      return;
    }

    if (oversizedFile) {
      setSelectedFiles([]);
      setImageInputKey((current) => current + 1);
      setImageError(`Each image must be ${MAX_LISTING_IMAGE_MB} MB or less before compression.`);
      return;
    }

    let acceptedFiles: File[];
    try {
      acceptedFiles = files.map((file, index) => normalizeListingImageFile(file, index));
    } catch (error) {
      setSelectedFiles([]);
      setImageInputKey((current) => current + 1);
      setImageError(getUploadFailureMessage(error));
      return;
    }

    clearImageError();
    setSelectedFiles(acceptedFiles);
    setUploadThumbnailIndex(0);
    event.currentTarget.value = "";
  }

  function getUploadFailureMessage(error: unknown) {
    if (!(error instanceof Error)) {
      return "We could not upload the selected photos. Check your connection and try again with fewer photos.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("image_compress_failed")) {
      return "Image could not be compressed on this phone. Try JPG or upload fewer photos. Upload code: IMAGE_COMPRESS_FAILED";
    }

    if (message.includes("server_image_upload_failed")) {
      return "Server image upload failed. Please try again or choose fewer photos. Upload code: SERVER_IMAGE_UPLOAD_FAILED";
    }

    if (message.includes("server_upload_response_missing")) {
      return "Server upload completed without an image URL. Try again with fewer photos. Upload code: SERVER_UPLOAD_RESPONSE_MISSING";
    }

    if (message.includes("logged in") || message.includes("session") || message.includes("jwt")) {
      return "Your session expired. Log in again before uploading images.";
    }

    if (message.includes("raw photos")) {
      return "RAW photos are too large for listing uploads. Export as JPG first.";
    }

    if (message.includes("phone photo")) {
      return error.message;
    }

    if (message.includes("selected photos") || message.includes("without an image url")) {
      return "We could not upload the selected photos. Check your connection and try again with fewer photos.";
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
      return `This file type is not supported. Upload ${SUPPORTED_LISTING_IMAGE_LABEL} images.`;
    }

    if (message.includes("size") || message.includes("too large")) {
      return `Each image must be ${MAX_LISTING_IMAGE_MB} MB or less before compression.`;
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
    const imageFiles = selectedFiles.filter((file) => file.size > 0);
    const featurePayload: Record<string, string[]> = {};

    for (const group of LISTING_FEATURE_GROUPS) {
      featurePayload[group.key] = featureValuesFromForm(form, group.key);
    }

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
      ...featurePayload,
      landSize: optionalNumber(form, "landSize"),
      landSizeUnit: optionalString(form, "landSizeUnit"),
      titleDocumentType: optionalString(form, "titleDocumentType"),
      zoningType: optionalString(form, "zoningType"),
      roadAccess: optionalString(form, "roadAccess")
    };

    try {
      if (imageFiles.length) {
        try {
          const uploadedImages = await uploadListingImages(moveToFront(imageFiles, uploadThumbnailIndex), token);
          payload.imageUrls = uploadedImages.imageUrls;
          payload.imageVariants = uploadedImages.imageVariants;
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
      setMessage(
        listing
          ? "Listing updated."
          : response.listing.status === "active"
            ? "Listing published successfully."
            : "Listing submitted for review."
      );
      setFieldErrors({});
      if (!listing) {
        formElement.reset();
        setSelectedFiles([]);
        setPreviewUrls([]);
        setImageInputKey((current) => current + 1);
        setUploadThumbnailIndex(0);
        setExistingThumbnailIndex(0);
        setSelectedState("");
        setSelectedLga("");
        setPropertyType("apartment");
        setListingCategory("for_sale");
        setAvailability("available");
        setContactPhone("");
        setContactWhatsapp("");
        setWhatsappSameAsPhone(true);
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

  const roomsDefaultOpen = Boolean(listing?.bedrooms || listing?.bathrooms || listing?.toilets || listing?.parkingSpaces);
  const buildingDefaultOpen = Boolean(
    listing?.propertySize ||
      listing?.yearBuilt ||
      listing?.floorLevel ||
      listing?.totalFloors ||
      listing?.furnishingStatus ||
      listing?.servicingStatus ||
      listing?.propertyCondition
  );
  const amenitiesDefaultOpen = Boolean(
    listing?.amenities.length ||
      listing?.utilities.length ||
      listing?.safetyFeatures.length ||
      listing?.nearbyLandmarks.length ||
      listing?.extraFeatures.length
  );
  const landDefaultOpen = Boolean(listing?.landSize || listing?.titleDocumentType || listing?.zoningType || listing?.roadAccess);
  const isLandType = propertyType === "land";

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
          <select
            className="input"
            name="propertyType"
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value as typeof propertyType)}
          >
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
            <option value="">{selectedState ? "Select city" : "Select state first"}</option>
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
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <input
            className="input"
            name="contactPhone"
            value={contactPhone}
            placeholder="Contact phone"
            onChange={(event) => {
              setContactPhone(event.target.value);
              if (whatsappSameAsPhone) {
                setContactWhatsapp(event.target.value);
              }
            }}
          />
          {fieldErrors.contactPhone ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.contactPhone}</p> : null}
        </div>
        <div>
          <input
            className="input"
            name="contactWhatsapp"
            value={contactWhatsapp}
            readOnly={whatsappSameAsPhone}
            placeholder="WhatsApp number"
            onChange={(event) => setContactWhatsapp(event.target.value)}
          />
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={whatsappSameAsPhone}
              onChange={(event) => {
                setWhatsappSameAsPhone(event.target.checked);
                if (event.target.checked) {
                  setContactWhatsapp(contactPhone);
                }
              }}
            />
            WhatsApp same as phone
          </label>
          {fieldErrors.contactWhatsapp ? (
            <p className="mt-1 text-sm text-rose-600">{fieldErrors.contactWhatsapp}</p>
          ) : null}
        </div>
      </div>
      <div>
        <label
          htmlFor={`listing-gallery-${formKey}`}
          className="flex cursor-pointer items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          Select photos from gallery
        </label>
        <input
          id={`listing-gallery-${formKey}`}
          className="sr-only"
          name="images"
          key={imageInputKey}
          type="file"
          multiple
          accept="image/*"
          onChange={onImageChange}
        />
        <p className="mt-1 text-xs text-slate-500">
          Choose photos from your gallery. You can select up to {MAX_LISTING_IMAGES} images. {selectedFiles.length}/
          {MAX_LISTING_IMAGES} photos selected. Each original image must be {MAX_LISTING_IMAGE_MB} MB or less.
        </p>
        <p className="mt-1 text-xs text-slate-500">For iPhone HEIC photos, choose Options and send as JPG/Most Compatible.</p>
        <p className="mt-1 text-xs text-slate-500">The first selected image becomes the listing thumbnail.</p>
        {fieldErrors.images ? <p className="mt-1 text-sm text-rose-600">{fieldErrors.images}</p> : null}
      </div>
      {previewUrls.length ? (
        <div className="rounded-2xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-950">Choose upload thumbnail</p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
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
                  className="block h-20 w-full bg-cover bg-center sm:h-28"
                  style={{ backgroundImage: `url("${url}")` }}
                />
                <span className="block px-2 py-2 text-[11px] font-medium text-slate-600 sm:px-3">
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
      <OptionalSection
        title="Rooms"
        helper={isLandType ? "Usually not needed for land listings." : "Add rooms to improve search matching."}
        defaultOpen={roomsDefaultOpen}
        muted={isLandType}
      >
        {fieldErrors.quality ? <p className="mb-2 text-sm text-rose-600">{fieldErrors.quality}</p> : null}
        <div className="grid gap-3 md:grid-cols-4">
          <input className="input" name="bedrooms" type="number" min={1} defaultValue={listing?.bedrooms ?? ""} placeholder="Bedrooms" />
          <input className="input" name="bathrooms" type="number" min={1} defaultValue={listing?.bathrooms ?? ""} placeholder="Bathrooms" />
          <input className="input" name="toilets" type="number" min={1} defaultValue={listing?.toilets ?? ""} placeholder="Toilets" />
          <input className="input" name="parkingSpaces" type="number" min={1} defaultValue={listing?.parkingSpaces ?? ""} placeholder="Parking spaces" />
        </div>
      </OptionalSection>
      <OptionalSection
        title="Building details"
        helper="Optional, but improves listing quality."
        defaultOpen={buildingDefaultOpen}
      >
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
      </OptionalSection>
      <OptionalSection
        title="Amenities and features"
        helper="Select common features quickly, or type anything missing."
        defaultOpen={amenitiesDefaultOpen}
      >
        <div className="grid gap-4">
          {LISTING_FEATURE_GROUPS.map((group) => {
            const savedValues = listing ? listing[group.key] : [];
            const { selected, customText } = splitListingFeatureValues(savedValues, group.options);
            const selectedValues = new Set(selected);

            return (
              <div key={group.key} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{group.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{group.helper}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.options.map((option) => (
                    <label key={option} className="inline-flex">
                      <input
                        className="peer sr-only"
                        type="checkbox"
                        name={`${group.key}Selected`}
                        value={option}
                        defaultChecked={selectedValues.has(option)}
                      />
                      <span className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition peer-checked:border-teal-700 peer-checked:bg-teal-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-teal-200">
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
                <input
                  className="input mt-3"
                  name={`${group.key}Custom`}
                  defaultValue={customText}
                  placeholder={group.customPlaceholder}
                />
                {fieldErrors[group.key] ? <p className="mt-1 text-sm text-rose-600">{fieldErrors[group.key]}</p> : null}
              </div>
            );
          })}
        </div>
      </OptionalSection>
      <OptionalSection
        title="Land and commercial details"
        helper="Useful for land, shops, offices, and commercial listings."
        defaultOpen={landDefaultOpen || isLandType}
      >
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
      </OptionalSection>
      <button className="button-primary inline-flex items-center justify-center gap-2" disabled={isSubmitting}>
        {isSubmitting ? <ButtonSpinner /> : null}
        {isSubmitting ? "Posting property..." : "Post Property"}
      </button>
      {message ? <p className="text-sm text-slate-500">{message}</p> : null}
    </form>
  );
}

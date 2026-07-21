import { ZodError, type ZodIssue } from "zod";

import { MAX_LISTING_IMAGES } from "@/lib/image-limits";

function mapImageIssue(issue: ZodIssue) {
  if (issue.code === "too_small") {
    return "Upload at least one property image.";
  }

  if (issue.code === "too_big") {
    return `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove extra images and try again.`;
  }

  return "One or more uploaded images could not be verified. Please choose the images again and submit. Use JPG, PNG, or WebP files under 5 MB.";
}

export function mapListingErrors(error: ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path === "title") {
      fields.title = "Title must be at least 8 characters.";
    } else if (path === "description") {
      fields.description = "Description must be at least 20 characters.";
    } else if (path.startsWith("imageUrls") || path.startsWith("imageVariants")) {
      fields.images = mapImageIssue(issue);
    } else if (path === "price") {
      fields.price = "Enter a valid property price.";
    } else if (path === "contactPhone") {
      fields.contactPhone = "Enter a valid contact phone number.";
    } else if (path === "contactWhatsapp") {
      fields.contactWhatsapp = "Enter a valid WhatsApp number.";
    } else if (path === "location.state") {
      fields.state = "Enter a valid state.";
    } else if (path === "location.city") {
      fields.city = "Enter a valid city.";
    } else if (path === "location.area") {
      fields.area = "Enter a valid area.";
    } else if (
      [
        "bedrooms",
        "bathrooms",
        "toilets",
        "parkingSpaces",
        "propertySize",
        "yearBuilt",
        "floorLevel",
        "totalFloors",
        "landSize"
      ].includes(path)
    ) {
      fields.quality = "Enter valid optional property details.";
    } else if (
      [
        "propertySizeUnit",
        "landSizeUnit",
        "furnishingStatus",
        "servicingStatus",
        "propertyCondition",
        "titleDocumentType",
        "zoningType",
        "roadAccess"
      ].includes(path)
    ) {
      fields.quality = "Select valid optional property detail options.";
    } else if (["amenities", "utilities", "safetyFeatures", "nearbyLandmarks", "extraFeatures"].includes(path)) {
      fields.quality = "Enter no more than 30 short items per feature list.";
    }
  }

  return fields;
}

export function mapListingRuntimeError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message.includes("listings_image_variants_check")) {
    return {
      message: "The database image limit is not updated for 15 photos yet. Run the latest Supabase schema, then try again.",
      fields: {
        images:
          "This listing has more images than the current database constraint allows. Run the latest Supabase schema update for 15 images."
      }
    };
  }

  return null;
}

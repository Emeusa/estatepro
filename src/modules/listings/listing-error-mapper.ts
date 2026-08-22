import { ZodError, type ZodIssue } from "zod";

import { MAX_LISTING_IMAGES } from "@/lib/image-limits";
import { ListingImagePayloadError } from "@/modules/listings/listing-image-payload";

function mapImageIssue(issue: ZodIssue) {
  const path = issue.path.map(String);
  const lastSegment = path[path.length - 1];
  const isImageArrayIssue = path.length === 1 && (path[0] === "imageUrls" || path[0] === "imageVariants");

  if (issue.code === "too_small" && isImageArrayIssue) {
    return "Upload at least one property image.";
  }

  if (issue.code === "too_big" && isImageArrayIssue) {
    return `You can upload up to ${MAX_LISTING_IMAGES} images per listing. Remove extra images and try again.`;
  }

  if (lastSegment === "heroUrl" || lastSegment === "cardUrl" || path[0] === "imageUrls") {
    return "One or more image links are invalid. Please choose the images again and submit. Upload code: LISTING_IMAGE_URL_INVALID";
  }

  return "One or more uploaded images returned invalid metadata. Please choose the images again and submit. Upload code: LISTING_IMAGE_METADATA_INVALID";
}

export function summarizeListingImageIssues(error: ZodError) {
  return error.issues
    .filter((issue) => issue.path[0] === "imageUrls" || issue.path[0] === "imageVariants")
    .map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message
    }));
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

  if (error instanceof ListingImagePayloadError) {
    return {
      message: error.message,
      fields: {
        images: error.message
      }
    };
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

  if (error.message.includes("listings_area_slug_check")) {
    return {
      message: "Please correct the property location.",
      fields: {
        area: "Enter a valid property area using letters and numbers."
      }
    };
  }

  return null;
}

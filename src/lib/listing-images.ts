import { ListingImageVariant, ListingRecord } from "@/lib/types";

type ListingImageSource = {
  heroUrl: string;
  cardUrl: string;
  blurDataUrl: string | null;
  isPreprocessed: boolean;
};

export function getListingImages(
  listing: Pick<ListingRecord, "imageUrls" | "imageVariants">
): ListingImageSource[] {
  if (listing.imageVariants.length) {
    return [...listing.imageVariants]
      .sort((first, second) => first.order - second.order)
      .map((image) => ({
        heroUrl: image.heroUrl,
        cardUrl: image.cardUrl,
        blurDataUrl: image.blurDataUrl,
        isPreprocessed: true
      }));
  }

  return listing.imageUrls.map((url) => ({
    heroUrl: url,
    cardUrl: url,
    blurDataUrl: null,
    isPreprocessed: false
  }));
}

export function getListingHeroImage(listing: Pick<ListingRecord, "imageUrls" | "imageVariants">) {
  return getListingImages(listing)[0] ?? null;
}

export function getListingImageCount(listing: Pick<ListingRecord, "imageUrls" | "imageVariants">) {
  return listing.imageVariants.length || listing.imageUrls.length;
}

export function reorderListingImageVariants(images: ListingImageVariant[]) {
  return images.map((image, index) => ({ ...image, order: index }));
}

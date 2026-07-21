import { getListingImageCountLimitMessage, MAX_LISTING_IMAGES } from "@/lib/image-limits";

type ImageSelectionFile = Pick<File, "name" | "size" | "lastModified">;

function getLooseListingImageKey(file: ImageSelectionFile) {
  return file.lastModified ? `${file.size}:${file.lastModified}` : null;
}

export function getListingImageSelectionKey(file: ImageSelectionFile) {
  return `${file.name.toLowerCase()}:${file.size}:${file.lastModified || 0}`;
}

export function mergeListingImageSelection<TFile extends ImageSelectionFile>(
  existingFiles: TFile[],
  incomingFiles: TFile[],
  maxImages = MAX_LISTING_IMAGES
) {
  const selectedKeys = new Set(existingFiles.map(getListingImageSelectionKey));
  const selectedLooseKeys = new Set(existingFiles.map(getLooseListingImageKey).filter(Boolean));
  const addedFiles: TFile[] = [];
  let ignoredDuplicateCount = 0;

  for (const file of incomingFiles) {
    const key = getListingImageSelectionKey(file);
    const looseKey = getLooseListingImageKey(file);
    const isDuplicate = selectedKeys.has(key) || Boolean(looseKey && selectedLooseKeys.has(looseKey));

    if (isDuplicate) {
      ignoredDuplicateCount += 1;
      continue;
    }

    selectedKeys.add(key);
    if (looseKey) {
      selectedLooseKeys.add(looseKey);
    }
    addedFiles.push(file);
  }

  const totalCount = existingFiles.length + addedFiles.length;
  const errorMessage = totalCount > maxImages ? getListingImageCountLimitMessage(totalCount) : null;

  return {
    files: errorMessage ? existingFiles : [...existingFiles, ...addedFiles],
    addedFiles: errorMessage ? [] : addedFiles,
    ignoredDuplicateCount,
    errorMessage
  };
}

export function getThumbnailIndexAfterImageRemoval(currentIndex: number, removedIndex: number, remainingCount: number) {
  if (remainingCount <= 0) {
    return 0;
  }

  if (currentIndex === removedIndex) {
    return Math.min(removedIndex, remainingCount - 1);
  }

  if (currentIndex > removedIndex) {
    return currentIndex - 1;
  }

  return currentIndex;
}

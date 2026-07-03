"use client";

const WEBP_TYPE = "image/webp";
const HERO_MAX_WIDTH = 1200;
const HERO_MAX_HEIGHT = 900;
const HERO_QUALITY = 0.82;
const CARD_MAX_WIDTH = 600;
const CARD_MAX_HEIGHT = 450;
const CARD_QUALITY = 0.75;
const BLUR_WIDTH = 10;
const BLUR_QUALITY = 0.55;

type RenderedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export type ProcessedListingImage = {
  hero: File;
  card: File;
  blurDataUrl: string;
  width: number;
  height: number;
  cardWidth: number;
  cardHeight: number;
};

async function loadImage(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageUrl;
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function getScaledSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function renderImage(
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<RenderedImage> {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("Could not read image dimensions.");
  }

  const size = getScaledSize(sourceWidth, sourceHeight, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image compression is not supported in this browser.");
  }

  context.drawImage(image, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, WEBP_TYPE, quality));

  if (!blob) {
    throw new Error("Failed to convert image to WebP.");
  }

  return { blob, ...size };
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result?.toString() ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function processListingImage(file: File): Promise<ProcessedListingImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are allowed.");
  }

  const image = await loadImage(file);
  const [hero, card, blur] = await Promise.all([
    renderImage(image, HERO_MAX_WIDTH, HERO_MAX_HEIGHT, HERO_QUALITY),
    renderImage(image, CARD_MAX_WIDTH, CARD_MAX_HEIGHT, CARD_QUALITY),
    renderImage(image, BLUR_WIDTH, HERO_MAX_HEIGHT, BLUR_QUALITY)
  ]);

  return {
    hero: new File([hero.blob], "hero.webp", { type: WEBP_TYPE }),
    card: new File([card.blob], "card.webp", { type: WEBP_TYPE }),
    blurDataUrl: await blobToDataUrl(blur.blob),
    width: hero.width,
    height: hero.height,
    cardWidth: card.width,
    cardHeight: card.height
  };
}

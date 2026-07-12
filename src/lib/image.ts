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

export type ListingImageWatermark =
  | { type: "platform" }
  | { type: "agent"; text: string };

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

let platformLogoPromise: Promise<HTMLImageElement> | null = null;

async function loadPlatformLogo() {
  if (!platformLogoPromise) {
    platformLogoPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = "/platform-logo-transparent.png";
    });
  }

  return platformLogoPromise;
}

function getScaledSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

function drawAgentWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string
) {
  const label = text.trim().replace(/\s+/g, " ").slice(0, 40) || "C59 Estatehub";
  const padding = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.045));
  const maxWidth = Math.round(width * 0.48);

  context.save();
  context.globalAlpha = 0.2;
  context.font = `900 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
  context.strokeStyle = "rgba(15, 23, 42, 0.5)";
  context.fillStyle = "rgba(255, 255, 255, 0.95)";
  context.shadowColor = "rgba(15, 23, 42, 0.35)";
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.12));
  context.strokeText(label, width - padding, height - padding, maxWidth);
  context.fillText(label, width - padding, height - padding, maxWidth);
  context.restore();
}

async function drawPlatformWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const padding = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const maxLogoWidth = Math.min(Math.round(width * 0.3), 260);
  const logo = await loadPlatformLogo();
  const logoRatio = logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 3;
  const logoWidth = Math.min(Math.max(72, maxLogoWidth), Math.max(1, width - padding * 2));
  const logoHeight = Math.round(logoWidth / logoRatio);

  context.save();
  context.globalAlpha = 0.28;
  context.drawImage(logo, width - logoWidth - padding, height - logoHeight - padding, logoWidth, logoHeight);
  context.restore();
}

async function applyWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark?: ListingImageWatermark
) {
  if (!watermark) {
    return;
  }

  if (watermark.type === "agent") {
    drawAgentWatermark(context, width, height, watermark.text);
    return;
  }

  try {
    await drawPlatformWatermark(context, width, height);
  } catch {
    drawAgentWatermark(context, width, height, "C59 Estatehub");
  }
}

async function renderImage(
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  watermark?: ListingImageWatermark
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
  await applyWatermark(context, size.width, size.height, watermark);
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

export async function processListingImage(
  file: File,
  watermark?: ListingImageWatermark
): Promise<ProcessedListingImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are allowed.");
  }

  const image = await loadImage(file);
  const [hero, card, blur] = await Promise.all([
    renderImage(image, HERO_MAX_WIDTH, HERO_MAX_HEIGHT, HERO_QUALITY, watermark),
    renderImage(image, CARD_MAX_WIDTH, CARD_MAX_HEIGHT, CARD_QUALITY, watermark),
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

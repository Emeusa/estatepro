"use client";

const WEBP_TYPE = "image/webp";
const JPEG_TYPE = "image/jpeg";
const HERO_MAX_WIDTH = 1200;
const HERO_MAX_HEIGHT = 900;
const HERO_QUALITY = 0.82;
const CARD_MAX_WIDTH = 600;
const CARD_MAX_HEIGHT = 450;
const CARD_QUALITY = 0.75;
const SAFE_HERO_MAX_WIDTH = 960;
const SAFE_HERO_MAX_HEIGHT = 720;
const SAFE_CARD_MAX_WIDTH = 480;
const SAFE_CARD_MAX_HEIGHT = 360;
const PREVIEW_MAX_WIDTH = 220;
const PREVIEW_MAX_HEIGHT = 180;
const PREVIEW_QUALITY = 0.72;
const BLUR_WIDTH = 10;
const BLUR_QUALITY = 0.55;

type RenderedImage = {
  blob: Blob;
  width: number;
  height: number;
  type: typeof WEBP_TYPE | typeof JPEG_TYPE;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type ImageSource = HTMLImageElement | ImageBitmap;

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

function readUint16(data: Uint8Array, offset: number) {
  return (data[offset] << 8) + data[offset + 1];
}

function readUint32(data: Uint8Array, offset: number) {
  return (
    ((data[offset] << 24) >>> 0) +
    (data[offset + 1] << 16) +
    (data[offset + 2] << 8) +
    data[offset + 3]
  );
}

function readUint24LittleEndian(data: Uint8Array, offset: number) {
  return data[offset] + (data[offset + 1] << 8) + (data[offset + 2] << 16);
}

async function readHeader(blob: Blob, bytes = 64 * 1024) {
  return new Uint8Array(await blob.slice(0, bytes).arrayBuffer());
}

function parseJpegDimensions(data: Uint8Array): ImageDimensions | null {
  if (data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = data[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const length = readUint16(data, offset + 2);
    if (length < 2 || offset + 2 + length > data.length) {
      break;
    }

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: readUint16(data, offset + 5),
        width: readUint16(data, offset + 7)
      };
    }

    offset += 2 + length;
  }

  return null;
}

function parsePngDimensions(data: Uint8Array): ImageDimensions | null {
  if (
    data[0] !== 0x89 ||
    data[1] !== 0x50 ||
    data[2] !== 0x4e ||
    data[3] !== 0x47 ||
    data[12] !== 0x49 ||
    data[13] !== 0x48 ||
    data[14] !== 0x44 ||
    data[15] !== 0x52
  ) {
    return null;
  }

  return {
    width: readUint32(data, 16),
    height: readUint32(data, 20)
  };
}

function parseWebpDimensions(data: Uint8Array): ImageDimensions | null {
  const header = String.fromCharCode(...data.slice(0, 12));
  if (!header.startsWith("RIFF") || !header.endsWith("WEBP")) {
    return null;
  }

  const chunk = String.fromCharCode(...data.slice(12, 16));
  if (chunk === "VP8X" && data.length >= 30) {
    return {
      width: readUint24LittleEndian(data, 24) + 1,
      height: readUint24LittleEndian(data, 27) + 1
    };
  }

  if (chunk === "VP8 " && data.length >= 30) {
    return {
      width: (data[26] + (data[27] << 8)) & 0x3fff,
      height: (data[28] + (data[29] << 8)) & 0x3fff
    };
  }

  if (chunk === "VP8L" && data.length >= 25 && data[20] === 0x2f) {
    return {
      width: 1 + data[21] + ((data[22] & 0x3f) << 8),
      height: 1 + ((data[22] >> 6) | (data[23] << 2) | ((data[24] & 0x0f) << 10))
    };
  }

  return null;
}

async function readImageDimensions(blob: Blob): Promise<ImageDimensions | null> {
  const header = await readHeader(blob);
  return parseJpegDimensions(header) ?? parsePngDimensions(header) ?? parseWebpDimensions(header);
}

async function loadImage(blob: Blob) {
  const imageUrl = URL.createObjectURL(blob);

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

async function createResizedBitmap(blob: Blob, sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  if (typeof createImageBitmap !== "function") {
    return null;
  }

  const size = getScaledSize(sourceWidth, sourceHeight, maxWidth, maxHeight);

  try {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: "from-image",
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: "high"
    });

    return {
      source: bitmap,
      width: size.width,
      height: size.height
    };
  } catch {
    return null;
  }
}

function closeImageSource(source: ImageSource) {
  if ("close" in source) {
    source.close();
  }
}

function drawAgentWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string
) {
  const label = text.trim().replace(/\s+/g, " ").slice(0, 40) || "C59 Estatehub";
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.05));
  const maxWidth = Math.round(width * 0.62);

  context.save();
  context.globalAlpha = 0.2;
  context.font = `900 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = Math.max(2, Math.round(fontSize * 0.1));
  context.strokeStyle = "rgba(15, 23, 42, 0.5)";
  context.fillStyle = "rgba(255, 255, 255, 0.95)";
  context.shadowColor = "rgba(15, 23, 42, 0.35)";
  context.shadowBlur = Math.max(2, Math.round(fontSize * 0.12));
  context.strokeText(label, width / 2, height / 2, maxWidth);
  context.fillText(label, width / 2, height / 2, maxWidth);
  context.restore();
}

async function drawPlatformWatermark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const maxLogoWidth = Math.min(Math.round(width * 0.36), 300);
  const logo = await loadPlatformLogo();
  const logoRatio = logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 3;
  const logoWidth = Math.min(Math.max(90, maxLogoWidth), Math.max(1, width * 0.72));
  const logoHeight = Math.round(logoWidth / logoRatio);

  context.save();
  context.globalAlpha = 0.28;
  context.drawImage(logo, (width - logoWidth) / 2, (height - logoHeight) / 2, logoWidth, logoHeight);
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
  source: ImageSource,
  width: number,
  height: number,
  quality: number,
  watermark?: ListingImageWatermark,
  preferredType: typeof WEBP_TYPE | typeof JPEG_TYPE = WEBP_TYPE
): Promise<RenderedImage> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image compression is not supported in this browser.");
  }

  let blob: Blob | null = null;
  let type = preferredType;

  try {
    context.drawImage(source, 0, 0, width, height);
    await applyWatermark(context, width, height, watermark);

    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, preferredType, quality));

    if (!blob || blob.type !== preferredType) {
      type = JPEG_TYPE;
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, JPEG_TYPE, quality));
    }
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }

  if (!blob || blob.type !== type) {
    throw new Error("Failed to compress image.");
  }

  return { blob, type, width, height };
}

async function renderImageFromBlob(
  blob: Blob,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  watermark?: ListingImageWatermark,
  preferredType: typeof WEBP_TYPE | typeof JPEG_TYPE = WEBP_TYPE
): Promise<RenderedImage> {
  const dimensions = await readImageDimensions(blob);
  let source: ImageSource | null = null;
  let width = 0;
  let height = 0;

  if (dimensions?.width && dimensions.height) {
    const resized = await createResizedBitmap(blob, dimensions.width, dimensions.height, maxWidth, maxHeight);
    if (resized) {
      source = resized.source;
      width = resized.width;
      height = resized.height;
    }
  }

  if (!source) {
    const image = await loadImage(blob);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Could not read image dimensions.");
    }

    const size = getScaledSize(sourceWidth, sourceHeight, maxWidth, maxHeight);
    source = image;
    width = size.width;
    height = size.height;
  }

  try {
    return await renderImage(source, width, height, quality, watermark, preferredType);
  } finally {
    closeImageSource(source);
  }
}

async function renderImageWithRetry(
  blob: Blob,
  maxWidth: number,
  maxHeight: number,
  safeMaxWidth: number,
  safeMaxHeight: number,
  quality: number,
  watermark?: ListingImageWatermark
) {
  try {
    return await renderImageFromBlob(blob, maxWidth, maxHeight, quality, watermark);
  } catch {
    return await renderImageFromBlob(blob, safeMaxWidth, safeMaxHeight, Math.min(quality, 0.74), watermark, JPEG_TYPE);
  }
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

  const hero = await renderImageWithRetry(
    file,
    HERO_MAX_WIDTH,
    HERO_MAX_HEIGHT,
    SAFE_HERO_MAX_WIDTH,
    SAFE_HERO_MAX_HEIGHT,
    HERO_QUALITY,
    watermark
  );
  const card = await renderImageWithRetry(
    file,
    CARD_MAX_WIDTH,
    CARD_MAX_HEIGHT,
    SAFE_CARD_MAX_WIDTH,
    SAFE_CARD_MAX_HEIGHT,
    CARD_QUALITY,
    watermark
  );
  const blur = await renderImageFromBlob(hero.blob, BLUR_WIDTH, HERO_MAX_HEIGHT, BLUR_QUALITY);

  return {
    hero: new File([hero.blob], hero.type === WEBP_TYPE ? "hero.webp" : "hero.jpg", { type: hero.type }),
    card: new File([card.blob], card.type === WEBP_TYPE ? "card.webp" : "card.jpg", { type: card.type }),
    blurDataUrl: await blobToDataUrl(blur.blob),
    width: hero.width,
    height: hero.height,
    cardWidth: card.width,
    cardHeight: card.height
  };
}

export async function createListingImagePreview(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image previews are allowed.");
  }

  const preview = await renderImageFromBlob(file, PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT, PREVIEW_QUALITY, undefined, JPEG_TYPE);
  return blobToDataUrl(preview.blob);
}

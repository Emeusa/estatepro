import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import sharp from "sharp";

import type { ListingImageWatermark } from "@/lib/image";

const require = createRequire(import.meta.url);
const heicConvert = require("heic-convert") as (options: {
  buffer: Buffer;
  format: "JPEG" | "PNG";
  quality?: number;
}) => Promise<Buffer | ArrayBuffer>;

const HERO_MAX_WIDTH = 1200;
const HERO_MAX_HEIGHT = 900;
const HERO_QUALITY = 82;
const CARD_MAX_WIDTH = 600;
const CARD_MAX_HEIGHT = 450;
const CARD_QUALITY = 75;
const BLUR_WIDTH = 10;
const BLUR_QUALITY = 55;
const MAX_INPUT_PIXELS = 50_000_000;

type ServerRenderedImage = {
  buffer: Buffer;
  width: number;
  height: number;
};

export type ServerProcessedListingImage = {
  hero: ServerRenderedImage;
  card: ServerRenderedImage;
  blurDataUrl: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function normalizeInputBuffer(input: Buffer, type: string) {
  if (type === "image/heic" || type === "image/heif") {
    const converted = await heicConvert({
      buffer: input,
      format: "JPEG",
      quality: 0.92
    });

    return Buffer.isBuffer(converted) ? converted : Buffer.from(new Uint8Array(converted));
  }

  return input;
}

async function createPlatformWatermarkSvg(width: number, height: number) {
  const logoPath = path.join(process.cwd(), "public", "platform-logo-transparent.png");
  const logoBuffer = await readFile(logoPath);
  const logo = sharp(logoBuffer);
  const metadata = await logo.metadata();
  const logoRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 3;
  const logoWidth = Math.min(Math.max(90, Math.round(width * 0.36)), 300, Math.max(1, Math.round(width * 0.72)));
  const logoHeight = Math.round(logoWidth / logoRatio);
  const x = Math.round((width - logoWidth) / 2);
  const y = Math.round((height - logoHeight) / 2);

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <image href="data:image/png;base64,${logoBuffer.toString("base64")}" x="${x}" y="${y}" width="${logoWidth}" height="${logoHeight}" opacity="0.28" preserveAspectRatio="xMidYMid meet"/>
    </svg>
  `);
}

function createAgentWatermarkSvg(width: number, height: number, text: string) {
  const label = escapeXml(text.trim().replace(/\s+/g, " ").slice(0, 40) || "C59 Estatehub");
  const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.05));
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.1));

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="${Math.max(2, Math.round(fontSize * 0.12))}" flood-color="#0f172a" flood-opacity="0.35"/>
      </filter>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="900" stroke="rgba(15, 23, 42, 0.5)" stroke-width="${strokeWidth}" fill="rgba(255, 255, 255, 0.95)" opacity="0.2" filter="url(#shadow)">${label}</text>
    </svg>
  `);
}

async function createWatermarkSvg(width: number, height: number, watermark?: ListingImageWatermark) {
  if (!watermark) {
    return null;
  }

  if (watermark.type === "agent") {
    return createAgentWatermarkSvg(width, height, watermark.text);
  }

  try {
    return await createPlatformWatermarkSvg(width, height);
  } catch {
    return createAgentWatermarkSvg(width, height, "C59 Estatehub");
  }
}

async function renderWebp(
  input: Buffer,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  watermark?: ListingImageWatermark
): Promise<ServerRenderedImage> {
  const resized = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const watermarkSvg = await createWatermarkSvg(resized.info.width, resized.info.height, watermark);
  const output = sharp(resized.data, { limitInputPixels: MAX_INPUT_PIXELS });
  const buffer = await (watermarkSvg ? output.composite([{ input: watermarkSvg }]) : output)
    .webp({ quality })
    .toBuffer();

  return {
    buffer,
    width: resized.info.width,
    height: resized.info.height
  };
}

async function renderBlur(input: Buffer) {
  const buffer = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: BLUR_WIDTH, height: HERO_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
    .webp({ quality: BLUR_QUALITY })
    .toBuffer();

  return `data:image/webp;base64,${buffer.toString("base64")}`;
}

export async function processListingImageOnServer(
  input: Buffer,
  type: string,
  watermark?: ListingImageWatermark
): Promise<ServerProcessedListingImage> {
  const normalizedInput = await normalizeInputBuffer(input, type);
  const [hero, card, blurDataUrl] = await Promise.all([
    renderWebp(normalizedInput, HERO_MAX_WIDTH, HERO_MAX_HEIGHT, HERO_QUALITY, watermark),
    renderWebp(normalizedInput, CARD_MAX_WIDTH, CARD_MAX_HEIGHT, CARD_QUALITY, watermark),
    renderBlur(normalizedInput)
  ]);

  return {
    hero,
    card,
    blurDataUrl
  };
}

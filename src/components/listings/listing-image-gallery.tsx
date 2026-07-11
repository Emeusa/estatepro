"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ListingImageSource } from "@/lib/listing-images";

type Props = {
  images: ListingImageSource[];
  title: string;
  unavailableBadge?: string | null;
};

function imageBlurProps(image: ListingImageSource) {
  return image.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: image.blurDataUrl } : {};
}

function ImageBackdrop({ image }: { image: ListingImageSource }) {
  return (
    <Image
      src={image.heroUrl}
      alt=""
      aria-hidden="true"
      fill
      className="scale-110 object-cover opacity-25 blur-xl"
      sizes="(max-width: 1024px) 100vw, 780px"
      quality={70}
      unoptimized={image.isPreprocessed}
      {...imageBlurProps(image)}
    />
  );
}

export function ListingImageGallery({ images, title, unavailableBadge }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const thumbnailScrollerRef = useRef<HTMLDivElement | null>(null);

  const selectedImage = images[selectedIndex] ?? null;
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  useEffect(() => {
    if (selectedIndex <= images.length - 1) {
      return;
    }

    setSelectedIndex(0);
  }, [images.length, selectedIndex]);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewOpen(false);
        return;
      }

      if (images.length <= 1) {
        return;
      }

      if (event.key === "ArrowRight") {
        setSelectedIndex((current) => (current + 1) % images.length);
      }

      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) => (current - 1 + images.length) % images.length);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, previewOpen]);

  function goToNext() {
    if (!hasMultipleImages) {
      return;
    }
    setSelectedIndex((current) => (current + 1) % images.length);
  }

  function goToPrevious() {
    if (!hasMultipleImages) {
      return;
    }
    setSelectedIndex((current) => (current - 1 + images.length) % images.length);
  }

  function scrollThumbnails(direction: "left" | "right") {
    thumbnailScrollerRef.current?.scrollBy({
      left: direction === "left" ? -260 : 260,
      behavior: "smooth"
    });
  }

  const previewModal =
    previewOpen && selectedImage && portalRoot
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} image preview`}
            className="fixed inset-0 z-[80] bg-slate-950/95 text-white"
          >
            <div className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-sm ring-1 ring-white/15 backdrop-blur">
              {selectedIndex + 1} / {images.length}
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white shadow-sm ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Close image preview"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 stroke-current stroke-2">
                <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
            <div className="relative h-full w-full px-3 py-16 sm:px-8">
              <Image
                src={selectedImage.heroUrl}
                alt={`${title} preview ${selectedIndex + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
                quality={78}
                unoptimized={selectedImage.isPreprocessed}
                {...imageBlurProps(selectedImage)}
              />
            </div>
            {hasMultipleImages ? (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white shadow-sm ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:left-5"
                  aria-label="Show previous image"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="m15.5 4.5-7 7.5 7 7.5 1.5-1.4-5.7-6.1L17 5.9l-1.5-1.4Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white shadow-sm ring-1 ring-white/15 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-5"
                  aria-label="Show next image"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="m8.5 19.5 7-7.5-7-7.5L7 5.9l5.7 6.1L7 18.1l1.5 1.4Z" />
                  </svg>
                </button>
              </>
            ) : null}
          </div>,
          portalRoot
        )
      : null;

  if (!selectedImage) {
    return (
      <div className="flex h-72 items-center justify-center rounded-3xl bg-stone-100 text-sm font-semibold text-slate-500 md:h-[28rem]">
        No image available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="group relative block h-80 w-full overflow-hidden rounded-3xl bg-stone-100 md:h-[28rem]"
          aria-label={`Open full preview for ${title}`}
        >
          <ImageBackdrop image={selectedImage} />
          <span className="absolute inset-0 bg-white/30" aria-hidden="true" />
          <Image
            src={selectedImage.heroUrl}
            alt={`${title} image ${selectedIndex + 1}`}
            fill
            className="object-contain transition duration-300 group-hover:scale-[1.01]"
            sizes="(max-width: 1024px) 100vw, 780px"
            quality={78}
            unoptimized={selectedImage.isPreprocessed}
            {...imageBlurProps(selectedImage)}
          />
          <span className="pointer-events-none absolute bottom-4 right-4 hidden rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-white/10 sm:inline-flex">
            Click to preview
          </span>
        </button>
        {unavailableBadge ? (
          <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
            {unavailableBadge}
          </span>
        ) : null}
        {hasMultipleImages ? (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              aria-label="Show previous listing image"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="m15.5 4.5-7 7.5 7 7.5 1.5-1.4-5.7-6.1L17 5.9l-1.5-1.4Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              aria-label="Show next listing image"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="m8.5 19.5 7-7.5-7-7.5L7 5.9l5.7 6.1L7 18.1l1.5 1.4Z" />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollThumbnails("left")}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-white sm:inline-flex"
            aria-label="Scroll thumbnails left"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="m15.5 4.5-7 7.5 7 7.5 1.5-1.4-5.7-6.1L17 5.9l-1.5-1.4Z" />
            </svg>
          </button>
          <div
            ref={thumbnailScrollerRef}
            className="flex min-w-0 flex-1 gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {images.map((image, index) => (
              <button
                key={`${image.cardUrl}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl bg-stone-100 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 sm:h-24 sm:w-36 ${
                  index === selectedIndex ? "ring-2 ring-amber-400 ring-offset-2" : "ring-1 ring-white/50 hover:ring-slate-400"
                }`}
                aria-label={`Show listing image ${index + 1}`}
                aria-current={index === selectedIndex ? "true" : undefined}
              >
                <Image
                  src={image.cardUrl}
                  alt=""
                  aria-hidden="true"
                  fill
                  className="scale-110 object-cover opacity-25 blur-lg"
                  sizes="144px"
                  quality={60}
                  unoptimized={image.isPreprocessed}
                  {...imageBlurProps(image)}
                />
                <span className="absolute inset-0 bg-white/25" aria-hidden="true" />
                <Image
                  src={image.cardUrl}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="144px"
                  quality={70}
                  unoptimized={image.isPreprocessed}
                  {...imageBlurProps(image)}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollThumbnails("right")}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-white sm:inline-flex"
            aria-label="Scroll thumbnails right"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="m8.5 19.5 7-7.5-7-7.5L7 5.9l5.7 6.1L7 18.1l1.5 1.4Z" />
            </svg>
          </button>
        </div>
      ) : null}
      {previewModal}
    </div>
  );
}

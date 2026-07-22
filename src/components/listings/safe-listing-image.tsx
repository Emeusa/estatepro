"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

import { shouldOptimizeListingImage } from "@/lib/listing-image-optimization";

type Props = Omit<ImageProps, "src" | "unoptimized" | "onError"> & {
  src: string;
  onError?: ImageProps["onError"];
};

export function SafeListingImage({ src, alt, onError, ...props }: Props) {
  const [useDirectImage, setUseDirectImage] = useState(false);
  const canUseOptimizer = shouldOptimizeListingImage(src);

  useEffect(() => {
    setUseDirectImage(false);
  }, [src]);

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={!canUseOptimizer || useDirectImage}
      onError={(event) => {
        onError?.(event);
        if (canUseOptimizer && !useDirectImage) {
          setUseDirectImage(true);
        }
      }}
    />
  );
}

"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

interface AiLogoProps {
  /** Width in pixels. Height is calculated from the logo's ~1.18:1 aspect ratio. */
  width?: number;
  /** Height in pixels. If provided, width is calculated from the aspect ratio. */
  height?: number;
  /** Additional CSS classes for the wrapper element */
  className?: string;
}

/**
 * Theme-aware AI logo component.
 * Renders ai-logo-light.svg in light mode and ai-logo-dark.svg in dark mode.
 * The SVGs have a native aspect ratio of ~1.18:1 (253×214).
 */
export const AiLogo = ({ width, height, className }: AiLogoProps) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after mount when theme is known
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate dimensions preserving aspect ratio (253.16 : 213.62 ≈ 1.185 : 1)
  const aspectRatio = 253.16 / 213.62;
  let w: number;
  let h: number;

  if (width && height) {
    w = width;
    h = height;
  } else if (width) {
    w = width;
    h = Math.round(width / aspectRatio);
  } else if (height) {
    h = height;
    w = Math.round(height * aspectRatio);
  } else {
    w = 40;
    h = Math.round(40 / aspectRatio);
  }

  const logoSrc =
    resolvedTheme === "dark" ? "/ai-logo-dark.svg" : "/ai-logo-light.svg";

  // Before mount, render a transparent placeholder to avoid layout shift
  if (!mounted) {
    return (
      <div
        className={className}
        style={{ width: w, height: h }}
        aria-hidden="true"
      />
    );
  }

  return (
    <Image
      src={logoSrc}
      width={w}
      height={h}
      alt="WestEd Chat logo"
      className={className}
      priority
    />
  );
};

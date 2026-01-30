"use server";
import "server-only";

import sharp from "sharp";

/**
 * Gets dimensions of an image from buffer
 * @param buffer - Image buffer
 * @returns Object with width and height, or null if cannot be determined
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch (error) {
    console.error("Error getting image dimensions:", error);
    return null;
  }
}

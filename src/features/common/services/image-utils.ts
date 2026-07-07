"use server";
import "server-only";

import sharp from "sharp";
import { IMAGE_CONFIG } from "@/features/common/config/image-config";

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

/**
 * Reads a Node.js ReadableStream into a Buffer with a timeout.
 * If the stream does not complete within the timeout, it is destroyed
 * and the promise rejects with a timeout error.
 *
 * @param stream - Node.js ReadableStream (e.g., from Azure Blob Storage)
 * @param timeoutMs - Maximum time to wait in milliseconds (defaults to IMAGE_CONFIG.BLOB_STREAM_TIMEOUT_MS)
 * @returns Buffer containing the full stream contents
 */
export async function streamToBufferWithTimeout(
  stream: NodeJS.ReadableStream,
  timeoutMs: number = IMAGE_CONFIG.BLOB_STREAM_TIMEOUT_MS
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        // Destroy the stream to free resources
        if (typeof (stream as any).destroy === "function") {
          (stream as any).destroy();
        }
        reject(new Error(`Blob stream read timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      }
    });

    stream.on("error", (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

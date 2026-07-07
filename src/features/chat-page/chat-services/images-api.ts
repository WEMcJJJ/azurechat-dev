import {
  GetImageFromStore,
  GetThreadAndImageFromUrl,
} from "./chat-image-service";
import { createHash } from "crypto";

/**
 * Derives the MIME content-type from an image filename extension.
 * Falls back to "image/png" for unrecognized extensions.
 */
function getContentTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

export const ImageAPIEntry = async (request: Request): Promise<Response> => {
  const urlPath = request.url;

  const response = await GetThreadAndImageFromUrl(urlPath);

  if (response.status !== "OK") {
    return new Response(response.errors[0].message, { status: 404 });
  }

  const { threadId, imgName } = response.response;
  const imageData = await GetImageFromStore(threadId, imgName);

  if (imageData.status === "OK") {
    // Generate ETag based on threadId and filename
    const etag = createHash('md5')
      .update(`${threadId}-${imgName}`)
      .digest('hex');
    
    // Check if client has cached version
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304 }); // Not Modified
    }
    
    return new Response(imageData.response, {
      headers: { 
        "content-type": getContentTypeFromFilename(imgName),
        "cache-control": "public, max-age=31536000, immutable",
        "etag": etag,
      },
    });
  } else {
    return new Response(imageData.errors[0].message, { status: 404 });
  }
};

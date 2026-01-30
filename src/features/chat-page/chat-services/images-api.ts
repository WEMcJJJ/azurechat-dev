import {
  GetImageFromStore,
  GetThreadAndImageFromUrl,
} from "./chat-image-service";
import { createHash } from "crypto";

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
        "content-type": "image/png",
        "cache-control": "public, max-age=3600, immutable",
        "etag": etag,
      },
    });
  } else {
    return new Response(imageData.errors[0].message, { status: 404 });
  }
};

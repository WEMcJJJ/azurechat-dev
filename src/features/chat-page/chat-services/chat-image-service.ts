"use server";
import "server-only";

import { ServerActionResponse } from "@/features/common/server-action-response";
import { GetBlob, UploadBlob } from "../../common/services/azure-storage";

const IMAGE_CONTAINER_NAME = "images";
// Use relative path so URLs work across all environments (local, dev, prod)
// The URLs stored in Cosmos DB will be environment-agnostic
const IMAGE_API_PATH = "/api/images";

export const GetBlobPath = async (threadId: string, blobName: string): Promise<string> => {
  return `${threadId}/${blobName}`;
};

export const UploadImageToStore = async (
  threadId: string,
  fileName: string,
  imageData: Buffer
): Promise<ServerActionResponse<string>> => {
  return await UploadBlob(
    IMAGE_CONTAINER_NAME,
    `${threadId}/${fileName}`,
    imageData
  );
};

export const GetImageFromStore = async (
  threadId: string,
  fileName: string
): Promise<ServerActionResponse<ReadableStream>> => {
  const blobPath = await GetBlobPath(threadId, fileName);
  return await GetBlob(IMAGE_CONTAINER_NAME, blobPath);
};

export const GetImageUrl = async (threadId: string, fileName: string): Promise<string> => {
  // Return relative URL (without domain) so it works across environments
  const params = `?t=${threadId}&img=${fileName}`;
  const url = `${IMAGE_API_PATH}${params}`;
  return url;
};

export const GetThreadAndImageFromUrl = async (
  urlString: string
): Promise<ServerActionResponse<{ threadId: string; imgName: string }>> => {
  // Strip sandbox: prefix if present
  let cleanUrl = urlString;
  if (cleanUrl.startsWith("sandbox:")) {
    cleanUrl = cleanUrl.substring(8); // Remove "sandbox:"
  }
  
  // Legacy base64 data URLs cannot be parsed as blob storage references
  if (cleanUrl.startsWith("data:image/")) {
    return {
      status: "ERROR",
      errors: [
        {
          message:
            "Legacy base64 image URL detected. This image predates blob storage and cannot be resolved to a blob path.",
        },
      ],
    };
  }
  
  // Get threadId and img from query parameters t and img
  // Strip any domain before /api/images and reconstruct with current environment's URL
  // This handles both old absolute URLs and new relative URLs
  let pathAndQuery: string;
  
  if (cleanUrl.includes("/api/images")) {
    // Extract everything from /api/images onwards
    pathAndQuery = cleanUrl.substring(cleanUrl.indexOf("/api/images"));
  } else {
    // If no /api/images found, assume it's already the path
    pathAndQuery = cleanUrl;
  }
  
  // Construct full URL with current environment's domain
  const fullUrl = `${process.env.NEXTAUTH_URL}${pathAndQuery}`;
  
  const url = new URL(fullUrl);
  const threadId = url.searchParams.get("t");
  const imgName = url.searchParams.get("img");

  // Check if threadId and img are valid
  if (!threadId || !imgName) {
    return {
      status: "ERROR",
      errors: [
        {
          message:
            "Invalid URL, threadId and/or imgName not formatted correctly.",
        },
      ],
    };
  }

  return {
    status: "OK",
    response: {
      threadId,
      imgName,
    },
  };
};


/**
 * Valid image sizes for GPT-Image-1.5
 * Note: Different from DALL-E 3 sizes
 */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

/**
 * Quality levels for GPT-Image-1.5
 * - low: Fastest, lowest cost
 * - medium: Balanced (default)
 * - high: Best quality, slower, higher cost
 */
export type ImageQuality = "low" | "medium" | "high";

/**
 * Input fidelity levels for image editing (gpt-image-1.5)
 * - low: Faster editing with less detail preservation
 * - high: Preserves faces, logos, and fine details (default)
 */
export type InputFidelity = "low" | "high";

/**
 * Arguments for image generation function
 * LLM provides prompt with conversation context but should not enhance artistically
 */
export interface CreateImageArgs {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
  n?: number; // 1-10, default 1
}

/**
 * Arguments for image editing function
 */
export interface EditImageArgs {
  imageUrl: string; // URL of the image to edit
  prompt: string; // Description of the edit to make
  size?: ImageSize;
  quality?: ImageQuality;
  n?: number; // 1-10, default 1
  input_fidelity?: InputFidelity; // Detail preservation level (default: "high")
}

/**
 * Successful image generation result (single image)
 */
export interface ImageGenerationSuccessSingle {
  success: true;
  url: string;
}

/**
 * Successful image generation result (multiple images)
 */
export interface ImageGenerationSuccessMultiple {
  success: true;
  urls: string[];
}

/**
 * Failed image generation result
 */
export interface ImageGenerationError {
  success: false;
  error: string;
}

export type ImageGenerationResult =
  | ImageGenerationSuccessSingle
  | ImageGenerationSuccessMultiple
  | ImageGenerationError
  | string; // For backward compatibility with simple string returns

/**
 * Image metadata cache size limit
 * Limits the number of images cached in sessionStorage per chat thread
 */
export const IMAGE_METADATA_CACHE_LIMIT = 20;

/**
 * Context information for generated/edited images
 * Enables natural language referencing like "edit the sunset from earlier"
 */
export interface ImageContext {
  prompt: string; // The prompt used to generate/edit the image
  userMessageId: string; // ID of the user message that requested the image
  timestamp: string; // ISO timestamp of generation
  operation: "create" | "edit"; // Type of operation
  sourceImageId?: string; // For edits, the ID of the source image
}

/**
 * Generation parameters for image operations
 */
export interface ImageGenerationParams {
  size: ImageSize;
  quality: ImageQuality;
  n: number;
  input_fidelity?: InputFidelity; // Only for edits
}

/**
 * Structured metadata returned by image tool functions
 * Replaces raw URL strings to enable better tracking and referencing
 */
export interface ImageToolResult {
  type: "image";
  imageIds: string[]; // Array of image IDs (filenames without extension)
  urls: string[]; // Array of full /api/images URLs
  titles?: string[]; // Optional titles for each image (auto-generated when n>1)
  context: ImageContext;
  generationParams: ImageGenerationParams;
}

/**
 * Type guard to check if content is structured ImageToolResult
 */
export function isImageToolResult(content: any): content is ImageToolResult {
  return (
    content &&
    typeof content === "object" &&
    content.type === "image" &&
    Array.isArray(content.imageIds) &&
    Array.isArray(content.urls) &&
    content.context &&
    content.generationParams
  );
}

/**
 * Type guard to check if content is legacy format (string or object with urls)
 */
export function isLegacyImageResult(content: any): boolean {
  if (typeof content === "string" && content.includes("/api/images")) {
    return true;
  }
  
  if (
    content &&
    typeof content === "object" &&
    Array.isArray(content.urls) &&
    !content.type // Legacy format doesn't have type field
  ) {
    return true;
  }
  
  return false;
}

/**
 * GPT-Image-1.5 API response structure
 */
export interface GPTImageResponse {
  created: number;
  data: Array<{
    b64_json: string;
  }>;
}

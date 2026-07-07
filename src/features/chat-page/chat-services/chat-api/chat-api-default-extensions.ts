"use server";
import "server-only";

import { ServerActionResponse } from "@/features/common/server-action-response";
import { OpenAIImageInstance } from "@/features/common/services/openai";
import { uniqueId } from "@/features/common/util";
import { GetImageUrl, UploadImageToStore } from "../chat-image-service";
import { ChatThreadModel } from "../models";
import { IMAGE_CONFIG } from "@/features/common/config/image-config";
import type {
  CreateImageArgs,
  EditImageArgs,
  ImageSize,
  ImageQuality,
  ImageToolResult,
  ImageContext,
  ImageGenerationParams,
} from "@/types/image-generation";
import { GetImageFromStore, GetThreadAndImageFromUrl } from "../chat-image-service";
import { getImageDimensions, streamToBufferWithTimeout } from "@/features/common/services/image-utils";

export const GetDefaultExtensions = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  signal: AbortSignal;
}): Promise<ServerActionResponse<Array<any>>> => {
  const defaultExtensions: Array<any> = [];

  // Add image creation Extension
  defaultExtensions.push({
    type: "function",
    function: {
      function: async (args: any) =>
        await executeCreateImage(
          args,
          props.chatThread.id,
          props.userMessage,
          props.signal
        ),
      parse: (input: string) => JSON.parse(input),
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "The image description from the user. Include context from the conversation if needed " +
              "(e.g., if user says 'create 3 more', specify what subject 'more' refers to). " +
              "CRITICAL: DO NOT add artistic enhancements, style suggestions, or extra details. " +
              "Only add minimal context needed for understanding references like 'it', 'more', 'same', etc.",
          },
          size: {
            type: "string",
            enum: ["1024x1024", "1024x1536", "1536x1024"],
            description:
              "Image dimensions. 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape). " +
              "Default: 1024x1024",
          },
          quality: {
            type: "string",
            enum: ["low", "medium", "high"],
            description:
              "Image quality level. 'low' is fastest, 'high' has most detail. " +
              "Default: medium",
          },
          n: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Number of images to generate (1-10). Default: 1",
          },
        },
        required: ["prompt"],
      },
      description:
        "Use this tool ONLY to create NEW images from scratch — meaning the user is describing something that does not yet exist in this conversation. " +
        "DO NOT use this tool if a relevant image already exists in the conversation and the user wants to modify it. " +
        "Specifically, DO NOT use create_img when the user says things like: " +
        "'make it...', 'make the X...', 'change the...', 'turn it into...', 'instead of...', 'more colorful', 'add a...', 'remove the...' — " +
        "these are EDIT requests and you MUST use edit_img instead. " +
        "ONLY use create_img when: (a) no relevant image exists yet, (b) the user explicitly asks to 'create a new' image, " +
        "or (c) the most recent image request FAILED (Tool output has 'error') and the user wants to retry. " +
        "RETRY HANDLING: " +
        "If the most recent Tool output has 'error' AND the user says 'try again' or adjusts the prompt, " +
        "get the original subject from the failed Create_img 'prompt' field and combine it with the user's adjustment. " +
        "Can generate multiple images in a single request if asked. " +
        "Pass the user's prompt with minimal context only - do not enhance artistically. " +
        "**IMPORTANT**: After the image is generated, you MUST include it in your response using markdown format: " +
        "![description](url) where 'url' is the URL returned by the tool. " +
        "Include a brief description of what was generated along with the image.",
      name: "create_img",
    },
  });

  // Add image editing Extension
  defaultExtensions.push({
    type: "function",
    function: {
      function: async (args: any) =>
        await executeEditImage(
          args,
          props.chatThread.id,
          props.signal
        ),
      parse: (input: string) => JSON.parse(input),
      parameters: {
        type: "object",
        properties: {
          imageUrl: {
            type: "string",
            description:
              "The URL of the image to edit. Valid formats include: " +
              "- Full URL: http://localhost:3000/api/images?t=...&img=... or https://domain.com/api/images?t=...&img=... " +
              "- Relative URL: /api/images?t=...&img=... " +
              "If the user provides a full URL with domain, extract and use just the path portion starting with /api/images. " +
              "IMPORTANT: If the user refers to 'the image', 'it', or a previously generated image without providing a URL, " +
              "you MUST look in the conversation history for a SUCCESSFUL tool result (one with 'type: image' and 'urls' array, NOT one with 'error'). " +
              "Use the URL from the tool output that matches what the user is referring to based on the 'context.prompt' field. " +
              "Do NOT use external URLs (like imgur, google images, etc.) - only URLs from this conversation's image generations.",
          },
          prompt: {
            type: "string",
            description:
              "Description of the edit to make. Be specific about what to change. " +
              "Examples: 'change the background to green', 'add a sunset', 'remove the clouds'.",
          },
          size: {
            type: "string",
            enum: ["1024x1024", "1024x1536", "1536x1024"],
            description:
              "Output image dimensions. Default: same as input image size.",
          },
          quality: {
            type: "string",
            enum: ["low", "medium", "high"],
            description:
              "Image quality level. 'low' is fastest, 'high' has most detail. " +
              "Default: medium",
          },
          n: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Number of edited variations to generate (1-10). Default: 1",
          },
          input_fidelity: {
            type: "string",
            enum: ["low", "high"],
            description:
              "Detail preservation level. 'high' (default) preserves faces, logos, and fine details. " +
              "'low' is faster but preserves fewer details.",
          },
        },
        required: ["imageUrl", "prompt"],
      },
      description:
        "Use this tool to edit, modify, or change an EXISTING image from this conversation. " +
        "WHEN TO USE THIS TOOL: Use edit_img whenever the user wants to alter a previously generated image. " +
        "Common trigger phrases include: 'make it...', 'make the X...', 'change the...', 'turn it into...', " +
        "'instead of...', 'add a...', 'remove the...', 'more colorful', 'less bright', or any reference to " +
        "modifying 'the image', 'it', or a specific aspect of a previously generated image. " +
        "If in doubt and a successful image exists in the conversation, prefer edit_img over create_img. " +
        "HOW TO FIND THE IMAGE URL: " +
        "Look in the conversation history for Tool outputs with 'type: image' and a 'urls' array — these are successful generations. " +
        "Match based on the preceding Create_img/Edit_img 'prompt' field, then use that URL. " +
        "The imageUrl MUST be from this conversation (format: /api/images?t=...&img=...). " +
        "FAILURE HANDLING: " +
        "If the MOST RECENT Tool output has 'error' (not 'urls'), the image was never created and cannot be edited. " +
        "In that case, use create_img to retry instead. " +
        "**IMPORTANT**: After editing, include the result using markdown: ![description](url).",
      name: "edit_img",
    },
  });

  // Add any other default Extension here

  return {
    status: "OK",
    response: defaultExtensions,
  };
};

/**
 * Cleans image prompt by removing phrases that specify the number of images.
 * The image API's `n` parameter handles the count, so we only need the
 * subject description. These regexes are intentionally narrow to avoid
 * stripping legitimate descriptive content from the prompt.
 *
 * Examples:
 *   "Create three images of a brontosaurus" -> "a brontosaurus"
 *   "Generate 5 pictures of cats" -> "cats"
 *   "Make two images of a sunset" -> "a sunset"
 *   "draw beautiful illustrations of a sunset" -> "draw beautiful illustrations of a sunset" (preserved)
 *   "a room with two photos on the wall" -> "a room with two photos on the wall" (preserved)
 */
function cleanImagePrompt(prompt: string): string {
  let cleaned = prompt.trim();
  
  // Regex 1: Strip leading "verb + quantity + media-noun" patterns.
  // e.g. "create three images of a cat" -> "a cat"
  // The quantity slot is restricted to digits or explicit number words to
  // avoid matching descriptive adjectives like "beautiful" or "fantasy".
  cleaned = cleaned.replace(
    /^(create|generate|make|draw|produce|build)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|multiple|several|some)\s+(images?|pictures?|photos?|drawings?|illustrations?)\s+(of|showing|depicting|with)?\s*/gi,
    ''
  );
  
  // Regex 2: Strip leading "quantity + media-noun" patterns (no verb).
  // e.g. "5 images of cats" -> "cats"
  // Anchored to ^ so it never matches quantity words in the middle of a
  // descriptive prompt like "a room with two photos on the wall".
  cleaned = cleaned.replace(
    /^(\d+|one|two|three|four|five|six|seven|eight|nine|ten|multiple|several|some)\s+(images?|pictures?|photos?)\s+(of|showing|depicting)?\s*/gi,
    ''
  );
  
  // Regex 3: Clean up any leading preposition left over from the above.
  // e.g. if Regex 1 produced "of a sunset", this trims it to "a sunset".
  cleaned = cleaned.replace(/^(of|showing|depicting|with)\s+/gi, '');
  
  // Collapse any double spaces introduced by the replacements and trim.
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // If the regexes accidentally removed everything, return the original.
  return cleaned || prompt;
}

/**
 * Extracts main subject from image prompt for title generation
 * Tries to get a single meaningful word, or adjective + noun if appropriate
 * Examples: 
 *   "a cat in front of a fireplace" -> "Cat"
 *   "an elephant at a zoo" -> "Elephant"
 *   "red dragon breathing fire" -> "Red Dragon"
 *   "medieval castle at sunset" -> "Medieval Castle"
 */
function extractSubjectFromPrompt(prompt: string): string {
  // Remove common leading words
  const cleaned = prompt
    .toLowerCase()
    .replace(/^(create|generate|make|draw|an?|the|some|several|multiple|\d+)\s+/gi, '')
    .trim();
  
  // Common prepositions that indicate the subject has ended
  const prepositions = /\b(in|on|at|of|with|for|by|from|to|into|onto|near|under|over|above|below|behind|beside|between|through|across|around|against|during|before|after|about|against|along|among|within|without)\b/i;
  
  // Split at first preposition
  const beforePreposition = cleaned.split(prepositions)[0].trim();
  
  // Take first 1-2 words (prefer single noun, but allow adjective + noun)
  const words = beforePreposition.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    return 'Image';
  }
  
  // If just one word, use it
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }
  
  // For multiple words, check if second word looks like an adjective or important descriptor
  // Take up to 2 words for cases like "red dragon", "medieval castle"
  const subject = words.slice(0, 2).join(' ');
  
  // Capitalize each word
  return subject
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Validates image generation arguments
 */
function validateImageArgs(args: CreateImageArgs): string | null {
  // Validate prompt exists
  if (!args.prompt || args.prompt.trim().length === 0) {
    return "No prompt provided";
  }

  // Validate prompt length
  if (args.prompt.length >= IMAGE_CONFIG.MAX_PROMPT_LENGTH) {
    return `Prompt is too long. Maximum ${IMAGE_CONFIG.MAX_PROMPT_LENGTH} characters allowed.`;
  }

  // Validate size if provided
  if (args.size && !IMAGE_CONFIG.VALID_SIZES.includes(args.size)) {
    return `Invalid size "${args.size}". Valid sizes: ${IMAGE_CONFIG.VALID_SIZES.join(", ")}`;
  }

  // Validate quality if provided
  if (args.quality && !IMAGE_CONFIG.VALID_QUALITIES.includes(args.quality)) {
    return `Invalid quality "${args.quality}". Valid qualities: ${IMAGE_CONFIG.VALID_QUALITIES.join(", ")}`;
  }

  // Validate n if provided
  if (args.n !== undefined) {
    if (
      !Number.isInteger(args.n) ||
      args.n < IMAGE_CONFIG.MIN_IMAGES ||
      args.n > IMAGE_CONFIG.MAX_IMAGES
    ) {
      return `Invalid number of images. Must be between ${IMAGE_CONFIG.MIN_IMAGES} and ${IMAGE_CONFIG.MAX_IMAGES}.`;
    }
  }

  return null; // No validation errors
}

/**
 * Validates that an external image URL returned by Azure OpenAI is safe to fetch.
 * This is a defense-in-depth measure against SSRF — the URL comes from Azure's API
 * response (not user input), but we validate it anyway in case of SDK bugs,
 * response tampering, or unexpected API behavior.
 *
 * Checks:
 *  1. URL is well-formed and uses HTTPS.
 *  2. Hostname matches the configured allowlist of Azure domain suffixes.
 *  3. Hostname is not a private/loopback IP address.
 *
 * Returns null if valid, or a string error message if rejected.
 */
function validateExternalImageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Malformed URL: ${url}`;
  }

  // Require HTTPS
  if (parsed.protocol !== "https:") {
    return `Rejected non-HTTPS image URL (protocol: ${parsed.protocol}): ${url}`;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block private/loopback IP addresses (hostname-level check, no DNS resolution)
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^169\.254\./,
    /^0\./,
    /^\[::1\]$/,
  ];
  if (privatePatterns.some(pattern => pattern.test(hostname))) {
    return `Rejected private/loopback image URL (hostname: ${hostname}): ${url}`;
  }

  // Check hostname against allowlist
  const allowedSuffixes = IMAGE_CONFIG.EXTERNAL_FETCH_ALLOWED_DOMAIN_SUFFIXES;
  const isAllowed = allowedSuffixes.some(suffix =>
    hostname === suffix.replace(/^\./, "") || hostname.endsWith(suffix)
  );

  if (!isAllowed) {
    return (
      `Rejected image URL from non-allowlisted domain (hostname: ${hostname}). ` +
      `Allowed suffixes: ${allowedSuffixes.join(", ")}. ` +
      `If this domain is legitimate, add it to AZURE_IMAGE_FETCH_ALLOWED_DOMAINS.`
    );
  }

  return null; // URL is safe to fetch
}

/**
 * Extension for image creation using GPT-Image-1.x
 * Supports generating 1-10 images per request
 */
async function executeCreateImage(
  args: CreateImageArgs,
  threadId: string,
  userMessage: string,
  signal: AbortSignal
) {
  const modelName =
    process.env.AZURE_OPENAI_GPT_IMAGE_API_DEPLOYMENT_NAME ||
    "image generation";

  // Validate arguments
  const validationError = validateImageArgs(args);
  if (validationError) {
    return validationError;
  }

  // Use validated values with defaults
  const size: ImageSize = args.size || IMAGE_CONFIG.DEFAULT_SIZE;
  const quality: ImageQuality = args.quality || IMAGE_CONFIG.DEFAULT_QUALITY;
  const n: number = args.n || 1;

  // Clean the prompt to remove "create X images" type phrases
  // The 'n' parameter handles the count, so we only need the subject description
  const cleanedPrompt = cleanImagePrompt(args.prompt);

  // Get OpenAI client for image generation
  const openAI = OpenAIImageInstance();

  let response;

  try {
    response = await openAI.images.generate(
      {
        model: IMAGE_CONFIG.MODEL,
        prompt: cleanedPrompt,
        size: size,
        quality: quality,
        n: n,
      },
      {
        signal,
      }
    );
  } catch (error: unknown) {
    console.error("🔴 Image generation error:", error);

    // Type guard for error handling
    const err = error as { code?: string; status?: number; message?: string };

    // Handle content filter errors
    if (err.code === "contentFilter") {
      return {
        error:
          `Image generation using ${modelName} was blocked by the content filter. Please try a different prompt.`,
      };
    }

    // Handle rate limiting
    if (err.status === 429) {
      return {
        error:
          "Too many requests to the image generation service. Please wait a moment and try again.",
      };
    }

    // Handle timeout/abort
    if (signal.aborted) {
      return {
        error: "Image generation was cancelled.",
      };
    }

    // Generic error
    return {
      error:
        `There was an error creating the image using ${modelName}: ` +
        (err.message || error) +
        " Return this message to the user and halt execution.",
    };
  }

  // Validate response
  if (!response.data || response.data.length === 0) {
    return {
      error:
        `There was an error creating the image using ${modelName}: No image was generated. Return this message to the user and halt execution.`,
    };
  }

  // Upload all generated images to blob storage
  const urls: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < response.data.length; i++) {
    let imageData = response.data[i].b64_json;
    const imageUrl = (response.data[i] as any).url;

    // Handle both base64 and URL responses from Azure OpenAI
    if (!imageData && imageUrl) {
      // Validate the URL before fetching (defense-in-depth against SSRF)
      const urlError = validateExternalImageUrl(imageUrl);
      if (urlError) {
        console.warn(`⚠️ Image ${i + 1}: ${urlError}`);
        errors.push(`Image ${i + 1}: Blocked external fetch - ${urlError}`);
        continue;
      }

      try {
        const imageResponse = await fetch(imageUrl, {
          signal: AbortSignal.timeout(IMAGE_CONFIG.EXTERNAL_FETCH_TIMEOUT_MS),
        });
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageData = buffer.toString("base64");
      } catch (fetchError) {
        console.error(`Error fetching image ${i + 1} from Azure URL:`, fetchError);
        errors.push(`Image ${i + 1}: Failed to fetch - ${fetchError}`);
        continue;
      }
    }

    if (!imageData) {
      console.error(`Image ${i + 1}: Neither base64 nor URL provided in response`);
      errors.push(`Image ${i + 1}: No data returned (neither base64 nor URL)`);
      continue;
    }

    const imageName = `${uniqueId()}.png`;

    try {
      await UploadImageToStore(
        threadId,
        imageName,
        Buffer.from(imageData, "base64")
      );

      const url = await GetImageUrl(threadId, imageName);
      urls.push(url);
    } catch (error) {
      console.error(`Error uploading image ${i + 1}:`, error);
      errors.push(`Image ${i + 1}: Upload failed - ${error}`);
    }
  }

  if (errors.length > 0) {
    console.warn("Image generation/upload errors:", errors);
  }

  // Return results
  if (urls.length === 0) {
    return {
      error:
        `All image uploads failed using ${modelName}. ` +
        errors.join("; ") +
        " Return this message to the user and halt execution.",
    };
  }

  // Extract image IDs from URLs (filename without extension)
  const imageIds = urls.map(url => {
    const match = url.match(/img=([^&]+)/);
    if (match) {
      const filename = match[1];
      return filename.replace(/\.[^.]+$/, ''); // Remove extension
    }
    return uniqueId(); // Fallback if parsing fails
  });

  // Auto-generate titles for multiple images
  let titles: string[] | undefined;
  if (urls.length > 1) {
    const subject = extractSubjectFromPrompt(cleanedPrompt);
    titles = urls.map((_, i) => `${subject} ${i + 1}`);
  }

  // Create structured metadata result
  const context: ImageContext = {
    prompt: args.prompt,
    userMessageId: threadId, // Using threadId as proxy for now - will be updated by caller if needed
    timestamp: new Date().toISOString(),
    operation: "create",
  };

  const generationParams: ImageGenerationParams = {
    size,
    quality,
    n,
  };

  const result: ImageToolResult = {
    type: "image",
    imageIds,
    urls,
    titles,
    context,
    generationParams,
  };

  return result;
}

/**
 * Validates image editing arguments
 */
function validateEditImageArgs(args: EditImageArgs): string | null {
  // Validate imageUrl exists
  if (!args.imageUrl || args.imageUrl.trim().length === 0) {
    return "No image URL provided";
  }

  // Validate prompt exists
  if (!args.prompt || args.prompt.trim().length === 0) {
    return "No edit description provided";
  }

  // Validate prompt length
  if (args.prompt.length >= IMAGE_CONFIG.MAX_PROMPT_LENGTH) {
    return `Edit description is too long. Maximum ${IMAGE_CONFIG.MAX_PROMPT_LENGTH} characters allowed.`;
  }

  // Validate size if provided
  if (args.size && !IMAGE_CONFIG.VALID_SIZES.includes(args.size)) {
    return `Invalid size "${args.size}". Valid sizes: ${IMAGE_CONFIG.VALID_SIZES.join(", ")}`;
  }

  // Validate quality if provided
  if (args.quality && !IMAGE_CONFIG.VALID_QUALITIES.includes(args.quality)) {
    return `Invalid quality "${args.quality}". Valid qualities: ${IMAGE_CONFIG.VALID_QUALITIES.join(", ")}`;
  }

  // Validate n if provided
  if (args.n !== undefined) {
    if (
      !Number.isInteger(args.n) ||
      args.n < IMAGE_CONFIG.MIN_IMAGES ||
      args.n > IMAGE_CONFIG.MAX_IMAGES
    ) {
      return `Invalid number of images. Must be between ${IMAGE_CONFIG.MIN_IMAGES} and ${IMAGE_CONFIG.MAX_IMAGES}.`;
    }
  }

  return null; // No validation errors
}

/**
 * Extension for image editing using GPT-Image-1.x
 * Supports editing existing images with text prompts
 */
async function executeEditImage(
  args: EditImageArgs,
  threadId: string,
  signal: AbortSignal
) {
  const modelName =
    process.env.AZURE_OPENAI_GPT_IMAGE_API_DEPLOYMENT_NAME ||
    "image generation";

  // Validate arguments
  const validationError = validateEditImageArgs(args);
  if (validationError) {
    return validationError;
  }

  // Validate that the URL is from this application's /api/images endpoint
  // Strip sandbox: prefix and any leading/trailing whitespace first
  let cleanImageUrl = args.imageUrl.trim();
  if (cleanImageUrl.startsWith("sandbox:")) {
    cleanImageUrl = cleanImageUrl.substring(8);
  }
  
  // Check if it's a valid /api/images URL (relative or absolute with correct domain)
  const isRelativeApiUrl = cleanImageUrl.startsWith("/api/images");
  const isAbsoluteApiUrl = cleanImageUrl.includes("/api/images?");
  
  if (!isRelativeApiUrl && !isAbsoluteApiUrl) {
    return {
      error: 
        "Invalid image URL. You can only edit images that were generated in this conversation. " +
        "The image URL must be from a previous create_img tool call in this chat session. " +
        "Please use the URL from a recently generated image."
    };
  }

  // Use validated values with defaults (size will be determined after reading original image)
  const quality: ImageQuality = args.quality || IMAGE_CONFIG.DEFAULT_QUALITY;
  const n: number = args.n || 1;
  const inputFidelity = args.input_fidelity || IMAGE_CONFIG.DEFAULT_INPUT_FIDELITY;

  // Get the source image from storage
  const urlParseResult = await GetThreadAndImageFromUrl(cleanImageUrl);
  if (urlParseResult.status !== "OK") {
    return {
      error:
        "Invalid image URL. Please provide a URL from a previously generated image in this conversation.",
    };
  }

  const { threadId: sourceThreadId, imgName } = urlParseResult.response;

  // Verify the image belongs to the current thread (security check)
  if (sourceThreadId !== threadId) {
    return {
      error:
        "You can only edit images from the current conversation.",
    };
  }

  const imageResult = await GetImageFromStore(sourceThreadId, imgName);
  if (imageResult.status !== "OK") {
    return {
      error:
        "Failed to retrieve the source image. Please ensure the image URL is valid.",
    };
  }

  // Convert Node.js ReadableStream to Buffer (with timeout to prevent hanging)
  let imageBuffer: Buffer;
  try {
    imageBuffer = await streamToBufferWithTimeout(imageResult.response as any);
  } catch (streamError) {
    console.error("Error reading image stream:", streamError);
    return {
      error:
        "Failed to read the source image data. Please try again.",
    };
  }

  // Detect original image dimensions to maintain aspect ratio by default
  let originalSize: ImageSize = IMAGE_CONFIG.DEFAULT_SIZE;
  try {
    // Use sharp to detect dimensions for any format (PNG, WebP, JPEG, etc.)
    const dimensions = await getImageDimensions(imageBuffer);
    
    if (dimensions) {
      const { width, height } = dimensions;
      
      // Map to valid size
      if (width === 1024 && height === 1024) {
        originalSize = "1024x1024";
      } else if (width === 1024 && height === 1536) {
        originalSize = "1024x1536";
      } else if (width === 1536 && height === 1024) {
        originalSize = "1536x1024";
      } else {
        // Use closest match based on aspect ratio
        const aspectRatio = width / height;
        if (aspectRatio > 1.2) {
          originalSize = "1536x1024"; // Landscape
        } else if (aspectRatio < 0.8) {
          originalSize = "1024x1536"; // Portrait
        } else {
          originalSize = "1024x1024"; // Square
        }
      }
    }
  } catch (dimError) {
    // Use default size if dimension detection fails
  }

  // Use original size if user didn't specify a size
  const effectiveSize: ImageSize = args.size || originalSize;

  // Get OpenAI client for image editing
  const openAI = OpenAIImageInstance();

  let response;

  try {
    // Create a File-like object from the buffer
    // Convert Buffer to Uint8Array to avoid type issues
    const uint8Array = new Uint8Array(imageBuffer);
    const imageFile = new File([uint8Array], "image.png", { type: "image/png" });

    // Call the images.edit endpoint
    response = await openAI.images.edit(
      {
        image: imageFile as any,
        prompt: args.prompt,
        model: IMAGE_CONFIG.MODEL,
        size: effectiveSize,
        quality: quality,
        n: n,
        input_fidelity: inputFidelity,
      } as any,
      {
        signal,
      }
    );
  } catch (error: unknown) {
    console.error("🔴 Image editing error:", error);

    // Type guard for error handling
    const err = error as { code?: string; status?: number; message?: string };

    // Handle content filter errors
    if (err.code === "contentFilter") {
      return {
        error:
          `Image editing using ${modelName} was blocked by the content filter. Please try a different edit description.`,
      };
    }

    // Handle rate limiting
    if (err.status === 429) {
      return {
        error:
          "Too many requests to the image editing service. Please wait a moment and try again.",
      };
    }

    // Handle timeout/abort
    if (signal.aborted) {
      return {
        error: "Image editing was cancelled.",
      };
    }

    // Generic error
    return {
      error:
        `There was an error editing the image using ${modelName}: ` +
        (err.message || error) +
        " Return this message to the user and halt execution.",
    };
  }

  // Validate response
  if (!response.data || response.data.length === 0) {
    return {
      error:
        `There was an error editing the image using ${modelName}: No image was generated. Return this message to the user and halt execution.`,
    };
  }

  // Upload all edited images to blob storage
  const urls: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < response.data.length; i++) {
    let imageData = response.data[i].b64_json;
    const imageUrl = (response.data[i] as any).url;

    // Handle both base64 and URL responses from Azure OpenAI
    if (!imageData && imageUrl) {
      // Validate the URL before fetching (defense-in-depth against SSRF)
      const urlError = validateExternalImageUrl(imageUrl);
      if (urlError) {
        console.warn(`⚠️ Edited image ${i + 1}: ${urlError}`);
        errors.push(`Edited image ${i + 1}: Blocked external fetch - ${urlError}`);
        continue;
      }

      try {
        const imageResponse = await fetch(imageUrl, {
          signal: AbortSignal.timeout(IMAGE_CONFIG.EXTERNAL_FETCH_TIMEOUT_MS),
        });
        if (!imageResponse.ok) {
          throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageData = buffer.toString("base64");
      } catch (fetchError) {
        console.error(`Error fetching edited image ${i + 1} from Azure URL:`, fetchError);
        errors.push(`Edited image ${i + 1}: Failed to fetch - ${fetchError}`);
        continue;
      }
    }

    if (!imageData) {
      console.error(`Edited image ${i + 1}: Neither base64 nor URL provided in response`);
      errors.push(`Image ${i + 1}: No data returned (neither base64 nor URL)`);
      continue;
    }

    const imageName = `${uniqueId()}.png`;

    try {
      await UploadImageToStore(
        threadId,
        imageName,
        Buffer.from(imageData, "base64")
      );

      const url = await GetImageUrl(threadId, imageName);
      urls.push(url);
    } catch (error) {
      console.error(`Error uploading edited image ${i + 1}:`, error);
      errors.push(`Image ${i + 1}: Upload failed - ${error}`);
    }
  }

  if (errors.length > 0) {
    console.warn("Image editing/upload errors:", errors);
  }

  // Return results
  if (urls.length === 0) {
    return {
      error:
        `All image uploads failed using ${modelName}. ` +
        errors.join("; ") +
        " Return this message to the user and halt execution.",
    };
  }

  // Extract image IDs from URLs (filename without extension)
  const imageIds = urls.map(url => {
    const match = url.match(/img=([^&]+)/);
    if (match) {
      const filename = match[1];
      return filename.replace(/\.[^.]+$/, ''); // Remove extension
    }
    return uniqueId(); // Fallback if parsing fails
  });

  // Extract source image ID (remove extension)
  const sourceImageId = imgName.replace(/\.[^.]+$/, '');

  // Auto-generate titles for multiple edited images
  let titles: string[] | undefined;
  if (urls.length > 1) {
    const subject = extractSubjectFromPrompt(args.prompt);
    titles = urls.map((_, i) => `${subject} ${i + 1}`);
  }

  // Create structured metadata result
  const context: ImageContext = {
    prompt: args.prompt,
    userMessageId: threadId, // Using threadId as proxy for now - will be updated by caller if needed
    timestamp: new Date().toISOString(),
    operation: "edit",
    sourceImageId,
  };

  const generationParams: ImageGenerationParams = {
    size: effectiveSize,
    quality,
    n,
    input_fidelity: inputFidelity,
  };

  const result: ImageToolResult = {
    type: "image",
    imageIds,
    urls,
    titles,
    context,
    generationParams,
  };

  return result;
}

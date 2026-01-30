/**
 * Configuration for GPT-Image-1.5 image generation
 */
export const IMAGE_CONFIG = {
  /** Model identifier */
  MODEL: "gpt-image-1.5",
  
  /** Maximum prompt length in characters */
  MAX_PROMPT_LENGTH: 4000,
  
  /** Default image size */
  DEFAULT_SIZE: "1024x1024" as const,
  
  /** Default quality level */
  DEFAULT_QUALITY: "medium" as const,
  
  /** Valid image sizes for GPT-Image-1.5 */
  VALID_SIZES: ["1024x1024", "1024x1536", "1536x1024"] as const,
  
  /** Valid quality levels */
  VALID_QUALITIES: ["low", "medium", "high"] as const,
  
  /** Valid input fidelity levels for image editing */
  VALID_INPUT_FIDELITY: ["low", "high"] as const,
  
  /** Default input fidelity for editing - preserves faces, logos, fine details */
  DEFAULT_INPUT_FIDELITY: "high" as const,
  
  /** Maximum images per request */
  MAX_IMAGES: 10,
  
  /** Minimum images per request */
  MIN_IMAGES: 1,
  
  /** Whether model supports input_fidelity parameter */
  SUPPORTS_INPUT_FIDELITY: true,
  
  /** Maximum upload file size in megabytes */
  MAX_UPLOAD_SIZE_MB: 10,
  
  /** Maximum upload file size in bytes */
  MAX_UPLOAD_SIZE_BYTES: 10 * 1024 * 1024,
  
  /** Supported image upload formats */
  SUPPORTED_UPLOAD_FORMATS: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const,
  
  /** Maximum number of images to include in conversation history for multimodal context */
  MAX_HISTORY_IMAGES: 5,
} as const;

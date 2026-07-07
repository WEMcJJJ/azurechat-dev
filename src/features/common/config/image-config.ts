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
  MAX_HISTORY_IMAGES: 10,
  
  /** Timeout in milliseconds for reading blob storage streams */
  BLOB_STREAM_TIMEOUT_MS: 90_000,
  
  /** Timeout in milliseconds for fetching images from external URLs (e.g., Azure-returned URLs) */
  EXTERNAL_FETCH_TIMEOUT_MS: 90_000,

  /**
   * Allowed hostname suffixes for external image URL fetches.
   * When Azure OpenAI returns a URL instead of base64, the server fetches from
   * that URL. This allowlist restricts which domains are permitted (SSRF defense).
   *
   * Override via AZURE_IMAGE_FETCH_ALLOWED_DOMAINS env var (comma-separated).
   * Defaults cover standard Azure commercial cloud endpoints.
   * For Azure Government (.azure.us) or Azure China (.azure.cn), add the
   * appropriate suffixes to the env var.
   */
  EXTERNAL_FETCH_ALLOWED_DOMAIN_SUFFIXES: (
    process.env.AZURE_IMAGE_FETCH_ALLOWED_DOMAINS
      ? process.env.AZURE_IMAGE_FETCH_ALLOWED_DOMAINS.split(",").map(d => d.trim()).filter(Boolean)
      : [".openai.azure.com", ".blob.core.windows.net"]
  ),
} as const;

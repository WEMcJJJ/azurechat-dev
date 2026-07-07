import { proxy, useSnapshot } from "valtio";
import { IMAGE_CONFIG } from "@/features/common/config/image-config";
import { 
  ImageToolResult, 
  isImageToolResult, 
  IMAGE_METADATA_CACHE_LIMIT 
} from "@/types/image-generation";
import type { ChatMessageModel } from "@/features/chat-page/chat-services/models";

interface CachedImageMetadata {
  imageId: string;
  url: string;
  prompt: string;
  timestamp: string;
  operation: "create" | "edit";
  messageId: string;
}

class InputImageState {
  public previewImage: string = "";
  public base64Image: string = "";
  public fileUrl: string = "";
  public error: string = "";
  private metadataCache: Map<string, CachedImageMetadata[]> = new Map(); // chatId -> metadata[]

  get PreViewImage() {
    return this.previewImage;
  }

  public UpdateBase64Image(image: Base64URLString) {
    this.base64Image = image;
    this.previewImage = image;
    this.error = "";
  }

  public Reset() {
    this.previewImage = "";
    this.base64Image = "";
    this.fileUrl = "";
    this.error = "";
  }

  /**
   * Parse image metadata from chat history messages (lazy loading)
   * Called when user initiates image editing to enable context-based search
   */
  public parseImageMetadataFromHistory(chatId: string, messages: ChatMessageModel[]) {
    const cacheKey = `imageMetadataCache_${chatId}`;
    
    // Try to hydrate from sessionStorage first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedImageMetadata[];
        this.metadataCache.set(chatId, parsed);
        return;
      }
    } catch (err) {
      console.warn("Failed to parse cached image metadata:", err);
    }

    // Parse from messages if not in cache
    const metadata: CachedImageMetadata[] = [];
    
    for (const message of messages) {
      if (message.role === "function" && message.name === "tool" && message.hiddenToolResult) {
        try {
          const content = JSON.parse(message.content);
          if (isImageToolResult(content)) {
            // Add each image from the tool result
            content.imageIds.forEach((imageId, index) => {
              metadata.push({
                imageId,
                url: content.urls[index],
                prompt: content.context.prompt,
                timestamp: content.context.timestamp,
                operation: content.context.operation,
                messageId: message.id,
              });
            });
          }
        } catch (err) {
          // Skip malformed content
        }
      }
    }

    // Keep only last N images (FIFO)
    const limited = metadata.slice(-IMAGE_METADATA_CACHE_LIMIT);
    
    // Store in memory and sessionStorage
    this.metadataCache.set(chatId, limited);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(limited));
    } catch (err) {
      console.warn("Failed to save metadata to sessionStorage:", err);
    }
  }

  /**
   * Find images matching a context query (e.g., "the sunset", "previous image")
   * Returns single match or array for disambiguation
   */
  public findImageByContext(chatId: string, query: string): CachedImageMetadata | CachedImageMetadata[] | null {
    const cached = this.metadataCache.get(chatId);
    if (!cached || cached.length === 0) {
      return null;
    }

    const queryLower = query.toLowerCase();
    
    // Keywords for "recent" or "previous" images
    if (queryLower.includes("previous") || queryLower.includes("last") || queryLower.includes("recent")) {
      return cached[cached.length - 1]; // Most recent
    }

    // Keyword matching against prompts
    const matches = cached.filter(img => 
      img.prompt.toLowerCase().includes(queryLower)
    );

    if (matches.length === 0) {
      // No matches - return most recent as fallback
      return cached[cached.length - 1];
    } else if (matches.length === 1) {
      // Single match - return it
      return matches[0];
    } else {
      // Multiple matches - return array for disambiguation
      return matches;
    }
  }

  /**
   * Clear metadata cache for a specific chat (called on chat deletion)
   */
  public clearCacheForChat(chatId: string) {
    this.metadataCache.delete(chatId);
    try {
      sessionStorage.removeItem(`imageMetadataCache_${chatId}`);
    } catch (err) {
      console.warn("Failed to clear sessionStorage cache:", err);
    }
  }

  /**
   * Get all cached image metadata for a chat (for debugging)
   */
  public getCachedImages(chatId: string): CachedImageMetadata[] {
    return this.metadataCache.get(chatId) || [];
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject("Error converting file to base64");
        }
      };
    });
  }

  public async OnFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!IMAGE_CONFIG.SUPPORTED_UPLOAD_FORMATS.includes(file.type as any)) {
        this.error = `Unsupported file format. Please upload: ${IMAGE_CONFIG.SUPPORTED_UPLOAD_FORMATS.join(", ")}`;
        this.Reset();
        return;
      }
      
      // Validate file size
      if (file.size > IMAGE_CONFIG.MAX_UPLOAD_SIZE_BYTES) {
        this.error = `File size exceeds ${IMAGE_CONFIG.MAX_UPLOAD_SIZE_MB}MB limit. Please choose a smaller image.`;
        this.Reset();
        return;
      }
      
      try {
        const base64 = await this.fileToBase64(file);
        const url = URL.createObjectURL(file);
        this.previewImage = url;
        this.base64Image = base64;
        this.fileUrl = file.name;
        this.error = "";
      } catch (err) {
        this.error = "Error processing image file. Please try again.";
        this.Reset();
      }
    }
  }
}

export const InputImageStore = proxy(new InputImageState());

export const useInputImage = () => {
  return useSnapshot(InputImageStore, { sync: true });
};

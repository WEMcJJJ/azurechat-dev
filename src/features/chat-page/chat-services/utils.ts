import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";
import { ChatMessageModel } from "./models";
import { GetImageFromStore, GetThreadAndImageFromUrl } from "./chat-image-service";
import { IMAGE_CONFIG } from "@/features/common/config/image-config";
import { streamToBufferWithTimeout } from "@/features/common/services/image-utils";

export const mapOpenAIChatMessages = async (
  messages: ChatMessageModel[],
  includeImages: boolean = false
): Promise<ChatCompletionMessageParam[]> => {
  const mappedMessages: ChatCompletionMessageParam[] = [];
  
  // Track which tool_call_ids have been declared by assistant messages
  // This prevents orphaned tool messages from legacy conversations
  const validToolCallIds = new Set<string>();
  
  // Track the last message to detect and skip duplicate final assistant messages
  let lastAssistantWithToolCalls: ChatMessageModel | null = null;
  
  // Request-scoped cache for image buffers to prevent re-fetching same image
  const imageCache = new Map<string, Buffer>();
  
  // Failed image URLs for user notification
  const failedImages: string[] = [];
  
  // Limit image context to the most recent N messages with images
  const MAX_IMAGE_CONTEXT = IMAGE_CONFIG.MAX_HISTORY_IMAGES;
  const messagesWithImages = includeImages ? messages.filter(m => m.multiModalImage && m.multiModalImage.length > 0) : [];
  const totalImagesInHistory = messagesWithImages.length;
  const imagesToInclude = messagesWithImages.slice(-MAX_IMAGE_CONTEXT);
  const imageUrlsToInclude = new Set(imagesToInclude.map(m => m.multiModalImage).filter(Boolean) as string[]);
  const skippedImageCount = totalImagesInHistory - imagesToInclude.length;
  
  // Add warning message if we're skipping images
  if (skippedImageCount > 0) {
    mappedMessages.push({
      role: "system",
      content: `Note: This conversation has ${skippedImageCount} earlier image${skippedImageCount > 1 ? 's' : ''} not shown in context. To reference them, please upload them again.`,
    } as ChatCompletionMessageParam);
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    switch (message.role) {
      case "assistant":
        // Check if this is a duplicate final response after a tool call
        // Skip if: previous message was assistant with tool_calls AND this one has no tool_calls
        if (lastAssistantWithToolCalls && 
            (!message.tool_calls || message.tool_calls.length === 0)) {
          // This is the final assistant response after tool execution
          // Skip it in the OpenAI history (we already have the one with tool_calls)
          // But save it for the LAST message in conversation (for UI continuity)
          if (i === messages.length - 1) {
            // If this is the last message, include it (it's what user sees)
            const assistantMessage: ChatCompletionAssistantMessageParam = {
              role: message.role,
              content: message.content,
            };
            mappedMessages.push(assistantMessage);
          }
          lastAssistantWithToolCalls = null;
          continue;
        }
        
        // Include tool_calls if they exist to maintain proper OpenAI conversation format
        const assistantMessage: ChatCompletionAssistantMessageParam = {
          role: message.role,
          content: message.content,
        };
        
        if (message.tool_calls && message.tool_calls.length > 0) {
          assistantMessage.tool_calls = message.tool_calls;
          // Track all tool_call_ids from this assistant message
          message.tool_calls.forEach((tc: any) => {
            if (tc.id) validToolCallIds.add(tc.id);
          });
          lastAssistantWithToolCalls = message;
        } else {
          lastAssistantWithToolCalls = null;
        }
        
        mappedMessages.push(assistantMessage);
        break;
      case "tool":
      case "function":
        // Skip if explicitly marked as hidden (for UI purposes only)
        if (message.hiddenToolResult === true) {
          continue;
        }
        
        // Get the tool_call_id for this message
        const toolCallId = message.tool_call_id || message.id;
        
        // CRITICAL: Filter out orphaned tool messages from legacy conversations
        // Tool messages MUST have a corresponding assistant message with tool_calls
        // If this tool_call_id wasn't declared by an assistant message, skip it
        if (!validToolCallIds.has(toolCallId)) {
          console.debug(
            `Skipping orphaned tool message (id: ${message.id}, tool_call_id: ${toolCallId}) ` +
            `from legacy conversation. No corresponding assistant message with tool_calls found.`
          );
          continue;
        }
        
        mappedMessages.push({
          role: "tool",
          content: message.content,
          tool_call_id: toolCallId,
        });
        break;
      case "user":
        // Check if this message has an image and includeImages is true
        if (includeImages && message.multiModalImage) {
          let imageUrl = message.multiModalImage;
          
          // Strip sandbox: prefix if present
          if (imageUrl.startsWith("sandbox:")) {
            imageUrl = imageUrl.substring(8);
          }
          
          // Build content array with text and image
          const content: ChatCompletionContentPart[] = [
            { type: "text", text: message.content },
          ];
          
          // Add image - need to fetch from blob and convert to base64 for OpenAI
          // Only include if within the 10-image context limit
          if (includeImages && imageUrlsToInclude.has(imageUrl)) {
            if (imageUrl.startsWith("/api/images")) {
              try {
                // Check cache first
                let imageBuffer: Buffer | undefined = imageCache.get(imageUrl);
                let imgName: string = "unknown"; // Track filename for MIME type detection
                
                if (!imageBuffer) {
                  // Parse the URL to get threadId and imgName
                  const urlParseResult = await GetThreadAndImageFromUrl(imageUrl);
                  if (urlParseResult.status === "OK") {
                    const { threadId, imgName: parsedImgName } = urlParseResult.response;
                    imgName = parsedImgName;
                    
                    // Fetch image from blob storage
                    const imageResult = await GetImageFromStore(threadId, imgName);
                    if (imageResult.status === "OK") {
                      imageBuffer = await streamToBufferWithTimeout(imageResult.response as any);
                      
                      // Cache for this request
                      imageCache.set(imageUrl, imageBuffer);
                    } else {
                      console.error("Failed to fetch image from blob:", imageResult.errors);
                      failedImages.push(imgName);
                    }
                  } else {
                    console.error("Failed to parse image URL:", urlParseResult.errors);
                    failedImages.push(imageUrl);
                  }
                }
                
                // If we successfully got the buffer, add to content
                if (imageBuffer) {
                  // Determine MIME type from filename extension
                  const ext = imgName.split('.').pop()?.toLowerCase();
                  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' 
                    : ext === 'png' ? 'image/png' 
                    : ext === 'webp' ? 'image/webp'
                    : ext === 'gif' ? 'image/gif'
                    : 'image/png';
                  
                  const base64Data = imageBuffer.toString('base64');
                  const dataUrl = `data:${mimeType};base64,${base64Data}`;
                  
                  content.push({
                    type: "image_url",
                    image_url: { url: dataUrl },
                  });
                }
              } catch (error) {
                console.error("Error fetching image from blob storage:", error);
                failedImages.push(imageUrl);
              }
            } else if (imageUrl.startsWith("data:image/")) {
              // Base64 data URL can be passed directly
              content.push({
                type: "image_url",
                image_url: { url: imageUrl },
              });
            }
          }
          
          mappedMessages.push({
            role: message.role,
            content: content,
          } as ChatCompletionUserMessageParam);
        } else {
          // Text-only user message
          mappedMessages.push({
            role: message.role,
            content: message.content,
          } as ChatCompletionMessageParam);
        }
        break;
      default:
        mappedMessages.push({
          role: message.role,
          content: message.content,
        } as ChatCompletionMessageParam);
    }
  }
  
  // Add notification for failed images if any
  if (failedImages.length > 0) {
    mappedMessages.push({
      role: "system",
      content: `⚠️ Some images could not be loaded (${failedImages.length} unavailable). They may have been deleted or are temporarily unavailable.`,
    } as ChatCompletionMessageParam);
  }

  return mappedMessages;
};

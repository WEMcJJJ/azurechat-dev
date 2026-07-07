import { ChatMessageModel } from "./chat-services/models";
import { isImageToolResult } from "@/types/image-generation";

/**
 * Helper function to detect if a message is an image tool output.
 * Image tool outputs contain URLs to /api/images endpoint and should be
 * hidden from the chat UI since they only display raw URLs.
 * 
 * Priority order:
 * 1. Check hiddenToolResult flag (most reliable)
 * 2. Check for structured ImageToolResult metadata
 * 3. Fall back to content-based parsing for legacy messages
 * 
 * @param message - The chat message to check
 * @returns true if the message is an image tool output, false otherwise
 */
export function isImageToolOutput(message: ChatMessageModel): boolean {
  // Priority 1: Check explicit flag (most reliable)
  if (message.hiddenToolResult === true) {
    return true;
  }
  
  // Priority 2: Check for structured metadata (only applies if content is object)
  if (message.name === "tool") {
    try {
      const parsed = JSON.parse(message.content);
      if (isImageToolResult(parsed)) {
        return true;
      }
    } catch {
      // Not JSON, continue to legacy checks
    }
  }
  
  // Priority 3: Legacy content-based detection (backward compatibility)
  if (message.name !== "tool") return false;
  
  const content = message.content;
  
  // Check if it's a plain URL string pointing to /api/images
  if (typeof content === "string" && content.includes("/api/images")) {
    return true;
  }
  
  // Check if it's a JSON object with urls array (multiple images, legacy format)
  try {
    const parsed = JSON.parse(content);
    if (parsed.urls && Array.isArray(parsed.urls)) {
      return true;
    }
  } catch {
    // Not valid JSON, continue
  }
  
  return false;
}

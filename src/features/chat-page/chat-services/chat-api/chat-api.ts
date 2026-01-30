"use server";
import "server-only";

import { getCurrentUser } from "@/features/auth-page/helpers";
import { CHAT_DEFAULT_SYSTEM_PROMPT } from "@/features/theme/theme-config";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { ChatApiRAG } from "../chat-api/chat-api-rag";
import { FindAllChatDocuments } from "../chat-document-service";
import {
  CreateChatMessage,
  FindTopChatMessagesForCurrentUser,
} from "../chat-message-service";
import { EnsureChatThreadOperation } from "../chat-thread-service";
import {
  ChatThreadModel,
  SupportedFileExtensionsInputImages,
  UserPrompt,
} from "../models";
import { mapOpenAIChatMessages } from "../utils";
import { GetDefaultExtensions } from "./chat-api-default-extensions";
import { GetDynamicExtensions } from "./chat-api-dynamic-extensions";
import { ChatApiExtensions } from "./chat-api-extension";
import { ChatApiMultimodal } from "./chat-api-multimodal";
import { OpenAIStream } from "./open-ai-stream";
import {
  reportCompletionTokens,
  reportUserChatMessage,
} from "../../../common/services/chat-metrics-service";
import { ChatTokenService } from "@/features/common/services/chat-token-service";
import { UploadImageToStore, GetImageUrl } from "../chat-image-service";
import { uniqueId } from "@/features/common/util";
type ChatTypes = "extensions" | "chat-with-file" | "multimodal";

export const ChatAPIEntry = async (props: UserPrompt, signal: AbortSignal) => {
  const currentChatThreadResponse = await EnsureChatThreadOperation(props.id);

  if (currentChatThreadResponse.status !== "OK") {
    return new Response("", { status: 401 });
  }

  if (props.multimodalImage) {
    const base64Image = props.multimodalImage;
    const matches = base64Image.match(/^data:image\/([a-zA-Z]+);base64,/);
    const fileExtension = matches ? matches[1] : null;

    if (!fileExtension)
      return new Response("Missing File Extension", { status: 400 });

    if (
      !Object.values(SupportedFileExtensionsInputImages).includes(
        fileExtension.toUpperCase() as SupportedFileExtensionsInputImages
      )
    )
      return new Response("Filetype is not supported", { status: 400 });
  }

  const currentChatThread = currentChatThreadResponse.response;

  // Upload multimodal image to blob storage if present
  let imageUrlForStorage: string | undefined;
  if (props.multimodalImage && props.multimodalImage.startsWith("data:image/")) {
    try {
      // Extract MIME type and base64 data
      const matches = props.multimodalImage.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Convert to buffer
        const imageBuffer = Buffer.from(base64Data, "base64");
        
        // Generate filename (keep original extension for backward compatibility)
        const extension = mimeType === "jpeg" ? "jpg" : mimeType;
        const fileName = `uploaded-${uniqueId()}.${extension}`;
        
        // Upload to blob storage
        await UploadImageToStore(currentChatThread.id, fileName, imageBuffer);
        
        // Get URL for storage
        imageUrlForStorage = await GetImageUrl(currentChatThread.id, fileName);
      }
    } catch (error) {
      console.error("Error uploading image to blob storage:", error);
      // Fall back to base64 storage if upload fails
      imageUrlForStorage = props.multimodalImage;
    }
  }

  // promise all to get user, history and docs
  const [user, history, docs, extension] = await Promise.all([
    getCurrentUser(),
    _getHistory(currentChatThread),
    _getDocuments(currentChatThread),
    _getExtensions({
      chatThread: currentChatThread,
      userMessage: props.message,
      signal,
    }),
  ]);
  
  // Check if there are any images in the conversation history
  const historyResponse = await FindTopChatMessagesForCurrentUser(
    currentChatThread.id
  );
  const hasImagesInHistory = historyResponse.status === "OK" && 
    historyResponse.response.some(msg => msg.multiModalImage && msg.multiModalImage.length > 0);
  
  // Get history with images if current message has image OR if history contains images
  const historyWithImages = (props.multimodalImage || hasImagesInHistory)
    ? await _getHistoryWithImages(currentChatThread)
    : [];
  // Starting values for system and user prompt
  // Note that the system message will also get prepended with the extension execution steps. Please see ChatApiExtensions method.
  currentChatThread.personaMessage = `${CHAT_DEFAULT_SYSTEM_PROMPT} \n\n ${currentChatThread.personaMessage}`;

  let chatType: ChatTypes = "extensions";

  // If there's a current image OR images exist in history, use multimodal
  if ((props.multimodalImage && props.multimodalImage.length > 0) || hasImagesInHistory) {
    chatType = "multimodal";
  } else if (docs.length > 0) {
    chatType = "chat-with-file";
  } else if (extension.length > 0) {
    chatType = "extensions";
  }

  // Extract image URLs from message text for URL-based editing
  // Only extract URLs from current thread for security
  let extractedImageUrl: string | undefined;
  const imageUrlPattern = /\/api\/images\?t=([^&]+)&img=([^\s&)]+)/g;
  const urlMatches = Array.from(props.message.matchAll(imageUrlPattern));
  
  if (urlMatches.length > 0) {
    // Find first URL that matches current thread
    for (const match of urlMatches) {
      const urlThreadId = match[1];
      if (urlThreadId === currentChatThread.id) {
        extractedImageUrl = match[0]; // Use the full /api/images?t=...&img=... path
        console.log(`📎 Extracted image URL from message: ${extractedImageUrl}`);
        break;
      }
    }
    
    if (!extractedImageUrl && urlMatches.length > 0) {
      console.warn(`⚠️ User pasted image URL(s) from different thread - ignoring for security`);
    }
  }
  
  // Use extracted URL if no direct image upload
  const finalImageUrl = imageUrlForStorage || extractedImageUrl;
  
  // save the user message
  await CreateChatMessage({
    name: user.name,
    content: props.message,
    role: "user",
    chatThreadId: currentChatThread.id,
    multiModalImage: finalImageUrl, // Store blob URL, extracted URL, or undefined
  });

  let runner: ChatCompletionStreamingRunner;

  switch (chatType) {
    case "chat-with-file":
      runner = await ChatApiRAG({
        chatThread: currentChatThread,
        userMessage: props.message,
        history: history,
        signal: signal,
      });
      break;
    case "multimodal":
      runner = await ChatApiMultimodal({
        chatThread: currentChatThread,
        userMessage: props.message,
        file: props.multimodalImage, // May be empty for follow-up questions
        signal: signal,
        history: historyWithImages, // Include history with images
      });
      break;
    case "extensions":
      runner = await ChatApiExtensions({
        chatThread: currentChatThread,
        userMessage: props.message,
        history: history,
        extensions: extension,
        signal: signal,
      });
      break;
  }

  reportUserChatMessage("gpt-4", {
    personaMessageTitle: currentChatThread.personaMessageTitle,
    threadId: currentChatThread.id,
  });

  const readableStream = OpenAIStream({
    runner: runner,
    chatThread: currentChatThread,
  });

  runner.on("finalContent", async (finalContent: string) => {
    const chatTokenService = new ChatTokenService();
    const tokens = chatTokenService.getTokenCount(finalContent);
    reportCompletionTokens(tokens, "gpt-4", {
      personaMessageTitle: currentChatThread.personaMessageTitle,
    });
  });

  return new Response(readableStream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    },
  });
};

const _getHistory = async (chatThread: ChatThreadModel) => {
  const historyResponse = await FindTopChatMessagesForCurrentUser(
    chatThread.id
  );

  if (historyResponse.status === "OK") {
    const historyResults = historyResponse.response;
    return await mapOpenAIChatMessages(historyResults, false);
  }

  console.error("🔴 Error on getting history:", historyResponse.errors);

  return [];
};

const _getHistoryWithImages = async (chatThread: ChatThreadModel) => {
  const historyResponse = await FindTopChatMessagesForCurrentUser(
    chatThread.id
  );

  if (historyResponse.status === "OK") {
    const historyResults = historyResponse.response;
    return await mapOpenAIChatMessages(historyResults, true); // Include images
  }

  console.error("🔴 Error on getting history with images:", historyResponse.errors);

  return [];
};

const _getDocuments = async (chatThread: ChatThreadModel) => {
  const docsResponse = await FindAllChatDocuments(chatThread.id);

  if (docsResponse.status === "OK") {
    return docsResponse.response;
  }

  console.error("🔴 Error on AI search:", docsResponse.errors);
  return [];
};

const _getExtensions = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  signal: AbortSignal;
}) => {
  const extension: Array<any> = [];

  const response = await GetDefaultExtensions({
    chatThread: props.chatThread,
    userMessage: props.userMessage,
    signal: props.signal,
  });
  if (response.status === "OK" && response.response.length > 0) {
    extension.push(...response.response);
  }

  const dynamicExtensionsResponse = await GetDynamicExtensions({
    extensionIds: props.chatThread.extension,
  });
  if (
    dynamicExtensionsResponse.status === "OK" &&
    dynamicExtensionsResponse.response.length > 0
  ) {
    extension.push(...dynamicExtensionsResponse.response);
  }

  return extension;
};

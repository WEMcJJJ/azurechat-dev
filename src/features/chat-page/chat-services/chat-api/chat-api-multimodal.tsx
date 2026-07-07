"use server";
import "server-only";

import { OpenAIInstance } from "@/features/common/services/openai";
import { RunnableToolFunction } from "openai/lib/RunnableFunction";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatThreadModel } from "../models";
import { IMAGE_CONFIG } from "@/features/common/config/image-config";

export const ChatApiMultimodal = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  file: string;
  signal: AbortSignal;
  history?: ChatCompletionMessageParam[];
  extensions?: RunnableToolFunction<any>[];
}): Promise<ChatCompletionStreamingRunner> => {
  const { chatThread, userMessage, signal, file, history = [], extensions = [] } = props;

  const openAI = OpenAIInstance();

  // Build messages array starting with system message
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        chatThread.personaMessage +
        "\n You are an expert in extracting insights from images that are uploaded to the chat. \n You will answer questions about the image that is provided." +
        "\n You also have access to image generation tools (create_img, edit_img) to create or edit images when requested.",
    },
  ];

  // Include history if provided, but limit the number of images to preserve context window
  if (history && history.length > 0) {
    // Filter history to include only recent image-containing messages
    let imageCount = 0;
    const filteredHistory = history.filter((msg) => {
      if (msg.role === "user" && typeof msg.content !== "string") {
        // This is a message with image content
        if (imageCount < IMAGE_CONFIG.MAX_HISTORY_IMAGES) {
          imageCount++;
          return true;
        }
        // Exceeded max images - convert to text-only
        const textContent = msg.content.find((part: any) => part.type === "text");
        if (textContent && "text" in textContent) {
          msg.content = textContent.text;
          return true;
        }
        return false;
      }
      return true; // Include all non-image messages
    });
    
    messages.push(...filteredHistory);
  }

  // Add current user message with or without image
  if (file && file.length > 0) {
    // User uploaded a new image with this message
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage },
        {
          type: "image_url",
          image_url: {
            url: file,
          },
        },
      ],
    });
  } else {
    // Follow-up question without new image - just text
    messages.push({
      role: "user",
      content: userMessage,
    });
  }

  // If extensions are provided, use runTools to enable function calling
  if (extensions && extensions.length > 0) {
    return openAI.beta.chat.completions.runTools(
      {
        model: "",
        stream: true,
        max_completion_tokens: 8192,
        messages: messages,
        tools: extensions,
      },
      { signal }
    );
  }

  // No extensions - use standard streaming
  return openAI.beta.chat.completions.stream(
    {
      model: "",
      stream: true,
      max_completion_tokens: 8192,
      messages: messages,
    },
    { signal }
  );
};

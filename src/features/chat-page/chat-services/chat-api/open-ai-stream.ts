import { AI_NAME } from "@/features/theme/theme-config";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { CreateChatMessage } from "../chat-message-service";
import {
  AzureChatCompletion,
  AzureChatCompletionAbort,
  ChatThreadModel,
} from "../models";
import { isImageToolResult, isLegacyImageResult } from "@/types/image-generation";

export const OpenAIStream = (props: {
  runner: ChatCompletionStreamingRunner;
  chatThread: ChatThreadModel;
}) => {
  const encoder = new TextEncoder();

  const { runner, chatThread } = props;

  const readableStream = new ReadableStream({
    async start(controller) {
      const streamResponse = (event: string, value: string) => {
        controller.enqueue(encoder.encode(`event: ${event} \n`));
        controller.enqueue(encoder.encode(`data: ${value} \n\n`));
      };

      let lastMessage = "";
      let assistantMessageSaved = false;
      let currentToolCallId: string | null = null;
      let currentFunctionName: string | null = null;

      runner
        .on("content", (content) => {
          const completion = runner.currentChatCompletionSnapshot;

          if (completion) {
            const response: AzureChatCompletion = {
              type: "content",
              response: completion,
            };
            lastMessage = completion.choices[0].message.content ?? "";
            
            streamResponse(response.type, JSON.stringify(response));
          }
        })
        .on("functionCall", async (functionCall) => {
          // Save assistant message with tool_calls ONCE before first function call
          if (!assistantMessageSaved) {
            const completion = runner.currentChatCompletionSnapshot;
            if (completion) {
              const message = completion.choices[0].message;
              
              // Only save if there are tool_calls
              if (message.tool_calls && message.tool_calls.length > 0) {
                await CreateChatMessage({
                  name: AI_NAME,
                  content: message.content ?? "",
                  role: "assistant",
                  chatThreadId: chatThread.id,
                  tool_calls: message.tool_calls,
                });
                assistantMessageSaved = true;
              }
            }
          }
          
          // Extract the tool_call_id and function name from the completion snapshot
          // The functionCall event gives us name/arguments, but the id is in tool_calls
          currentFunctionName = functionCall.name; // Save function name (e.g., "create_img", "edit_img")
          const completion = runner.currentChatCompletionSnapshot;
          if (completion) {
            const message = completion.choices[0].message;
            if (message.tool_calls && message.tool_calls.length > 0) {
              // Find the tool call that matches this function call by name
              const matchingToolCall = message.tool_calls.find(
                (tc: any) => tc.function?.name === functionCall.name
              );
              if (matchingToolCall) {
                currentToolCallId = matchingToolCall.id;
              }
            }
          }

          const response: AzureChatCompletion = {
            type: "functionCall",
            response: functionCall,
          };
          streamResponse(response.type, JSON.stringify(response));
        })
        .on("functionCallResult", async (functionCallResult) => {
          // Detect if this is an image tool result (structured or legacy format)
          const isImageResult = isImageToolResult(functionCallResult) || 
                                isLegacyImageResult(functionCallResult);
          
          // For structured image results, extract only URLs for streaming to OpenAI
          // The full metadata is saved to DB but OpenAI only needs the URLs
          let contentToStream: string | { urls: string[] };
          if (isImageToolResult(functionCallResult)) {
            // Extract URLs array for OpenAI context
            contentToStream = functionCallResult.urls.length === 1 
              ? functionCallResult.urls[0]
              : { urls: functionCallResult.urls };
          } else {
            contentToStream = functionCallResult;
          }
          
          // Save tool result message with proper tool_call_id linking
          const isImageResult = isImageToolResult(functionCallResult);
          await CreateChatMessage({
            name: currentFunctionName || "tool", // Use actual function name (e.g., "create_img")
            content: JSON.stringify(functionCallResult), // Store full metadata
            role: "tool",
            chatThreadId: chatThread.id,
            hiddenToolResult: isImageResult, // Hide images - they'll render with assistant message
            tool_call_id: currentToolCallId!, // Link to the tool call from assistant message
          });
          
          // Clear the tool call ID and function name after saving the result
          currentToolCallId = null;
          currentFunctionName = null;
          
          // Stream the simplified content to OpenAI (just URLs, not full metadata)
          // Stringify the content for the response
          const response: AzureChatCompletion = {
            type: "functionCallResult",
            response: typeof contentToStream === 'string' 
              ? contentToStream 
              : JSON.stringify(contentToStream),
          };
          streamResponse(response.type, JSON.stringify(response));
        })
        .on("abort", (error) => {
          const response: AzureChatCompletionAbort = {
            type: "abort",
            response: "Chat aborted",
          };
          streamResponse(response.type, JSON.stringify(response));
          controller.close();
        })
        .on("error", async (error) => {
          console.log("🔴 error", error);
          const response: AzureChatCompletion = {
            type: "error",
            response: error.message,
          };

          // If there is an error, save the last message even though it is not complete
          // Only save if we haven't already saved a final complete message
          if (lastMessage && !assistantMessageSaved) {
            await CreateChatMessage({
              name: AI_NAME,
              content: lastMessage,
              role: "assistant",
              chatThreadId: props.chatThread.id,
            });
          }

          streamResponse(response.type, JSON.stringify(response));
          controller.close();
        })
        .on("finalContent", async (content: string) => {
          // Strip image markdown URLs to prevent duplicate rendering
          // The Markdown renderer would display these as inline images,
          // but we want images to only appear in the tool result accordion
          const cleanedContent = content.replace(
            /!\[([^\]]*)\]\(\/api\/images\?[^)]+\)/g,
            ''
          ).trim();
          
          // Only save finalContent if we haven't already saved an assistant message with tool_calls
          // This prevents duplicate assistant messages in existing chats
          if (!assistantMessageSaved) {
            await CreateChatMessage({
              name: AI_NAME,
              content: cleanedContent,
              role: "assistant",
              chatThreadId: props.chatThread.id,
            });
          }

          const response: AzureChatCompletion = {
            type: "finalContent",
            response: cleanedContent,
          };
          streamResponse(response.type, JSON.stringify(response));
          controller.close();
        });
    },
  });

  return readableStream;
};

import { AI_NAME } from "@/features/theme/theme-config";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { CreateChatMessage } from "../chat-message-service";
import {
  AzureChatCompletion,
  AzureChatCompletionAbort,
  ChatThreadModel,
} from "../models";
// Note: isImageToolResult kept for potential future use in differentiating tool result types

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
          
          // Save the function call message to the database
          // This stores the arguments that were passed to the function
          await CreateChatMessage({
            name: functionCall.name, // e.g., "create_img", "edit_img"
            content: functionCall.arguments,
            role: "function",
            chatThreadId: chatThread.id,
          });
          
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
          // functionCallResult is the return value from the tool function
          // It could be an object (ImageToolResult) or already a string
          const resultString = typeof functionCallResult === 'string' 
            ? functionCallResult 
            : JSON.stringify(functionCallResult);
          
          // Save tool result message with proper tool_call_id linking
          // Use "tool" as the name to differentiate from function calls (matches DALL-E 3 behavior)
          await CreateChatMessage({
            name: "tool",
            content: resultString, // Store full metadata as JSON string
            role: "tool",
            chatThreadId: chatThread.id,
            hiddenToolResult: false, // Show tool results
            tool_call_id: currentToolCallId!, // Link to the tool call from assistant message
          });
          
          // Clear the tool call ID and function name after saving the result
          currentToolCallId = null;
          currentFunctionName = null;
          
          // Stream the content to client
          const response: AzureChatCompletion = {
            type: "functionCallResult",
            response: resultString,
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
          console.error("OpenAI stream error:", error);
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
          // Don't strip image markdown URLs - let the Markdown component render them
          // This allows images to appear with the assistant's response text
          
          // Only save finalContent if we haven't already saved an assistant message with tool_calls
          // This prevents duplicate assistant messages in existing chats
          if (!assistantMessageSaved) {
            await CreateChatMessage({
              name: AI_NAME,
              content: content,
              role: "assistant",
              chatThreadId: props.chatThread.id,
            });
          }

          const response: AzureChatCompletion = {
            type: "finalContent",
            response: content,
          };
          streamResponse(response.type, JSON.stringify(response));
          controller.close();
        });
    },
  });

  return readableStream;
};

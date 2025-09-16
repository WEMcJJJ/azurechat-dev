import { AI_NAME } from "@/features/theme/theme-config";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { CreateChatMessage } from "../chat-message-service";
import { getModelConfigForThread } from "@/server/services/aoaiClientFactory";
import {
  AzureChatCompletion,
  AzureChatCompletionAbort,
  AzureChatCompletionFunctionCallResult,
  AzureChatCompletionFinalContent,
  ChatThreadModel,
  AzureChatCompletionImageBlocked,
  AzureChatCompletionImageBlockedPayload,
} from "../models";

export const OpenAIStream = (props: {
  runner: ChatCompletionStreamingRunner;
  chatThread: ChatThreadModel;
}) => {
  const encoder = new TextEncoder();

  const { runner, chatThread } = props;

  const readableStream = new ReadableStream({
    async start(controller) {
      const streamResponse = (event: string, value: string) => {
        try {
          if (!controller.desiredSize || controller.desiredSize <= 0) {
            return; // Controller is closed, don't try to enqueue
          }
          controller.enqueue(encoder.encode(`event: ${event} \n`));
          controller.enqueue(encoder.encode(`data: ${value} \n\n`));
        } catch (error) {
          console.warn("⚠️ Stream controller error (this is expected if request was cancelled):", error);
        }
      };

      // Helper function to get model friendly name
      const getModelFriendlyName = async (): Promise<string | undefined> => {
        try {
          if (props.chatThread.modelId) {
            const modelConfig = await getModelConfigForThread(props.chatThread.modelId);
            return modelConfig?.friendlyName;
          }
        } catch (error) {
          console.warn("Failed to get model friendly name:", error);
        }
        return undefined;
      };

      let lastMessage = "";

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
          await CreateChatMessage({
            name: functionCall.name,
            content: functionCall.arguments,
            role: "function",
            chatThreadId: chatThread.id,
          });

          const response: AzureChatCompletion = {
            type: "functionCall",
            response: functionCall,
          };
          streamResponse(response.type, JSON.stringify(response));
        })
        .on("functionCallResult", async (functionCallResult) => {
          console.log("🟡 Function Call Result:", typeof functionCallResult === 'string' ? functionCallResult.substring(0, 100) + "..." : JSON.stringify(functionCallResult).substring(0, 100) + "...");
          
          const response: AzureChatCompletion = {
            type: "functionCallResult",
            response: functionCallResult,
          };
          
          // Check if this is an error result (new object format)
          let isErrorResult = false;
          let contentToStore: string = "";
          
          if (typeof functionCallResult === 'object' && functionCallResult !== null) {
            // Cast to any to handle dynamic object properties
            const result = functionCallResult as any;
            if (result.error === true || 
                result.success === false || 
                (typeof result.error === 'string' && result.error !== '')) {
              console.log(`🔴 Detected error result of type: ${result.error}`);
              isErrorResult = true;
              // For display in UI, use the message content
              contentToStore = result.message || JSON.stringify(functionCallResult);
            } else {
              // Successful object result
              contentToStore = JSON.stringify(functionCallResult);
            }
          } else if (typeof functionCallResult === 'string') {
            // Legacy string format handling
            isErrorResult = functionCallResult.includes("FINAL_ERROR:") || 
                          functionCallResult.includes("🚫 **Image blocked by Azure Content Safety**");
            contentToStore = functionCallResult;
          } else {
            // Fallback for other types
            contentToStore = String(functionCallResult);
          }
          
          if (isErrorResult) {
            // For error results, create a function message that will show in UI
            await CreateChatMessage({
              name: "create_img",
              content: contentToStore,
              role: "function",
              chatThreadId: chatThread.id,
            });
          } else {
            // For successful results, use the normal structure
            await CreateChatMessage({
              name: "tool",
              content: contentToStore,
              role: "function",
              chatThreadId: chatThread.id,
            });
          }
          
          streamResponse(response.type, JSON.stringify(response));
        })
        .on("abort", (error) => {
          const response: AzureChatCompletionAbort = {
            type: "abort",
            response: "Chat aborted",
          };
          streamResponse(response.type, JSON.stringify(response));
          try {
            if (!controller.desiredSize || controller.desiredSize > 0) {
              controller.close();
            }
          } catch (error) {
            console.warn("⚠️ Stream controller already closed on abort");
          }
        })
        .on("error", async (error) => {
          console.log("🔴 OpenAI Stream Error:", error);
          console.log("🔴 Error type:", typeof error);
          console.log("🔴 Error message:", error.message);
          console.log("🔴 Error properties:", Object.keys(error));
          
          // Check if this is a content filter error that should be displayed as a Tool output
          const errorObj = error as any;
          if (errorObj.isContentFilterError || (typeof error.message === "string" && error.message.includes("🚫 **Image blocked by Azure Content Safety**"))) {
            console.log("🟡 Content filter error detected, emitting imageBlocked event");

            let payload: AzureChatCompletionImageBlockedPayload = errorObj.payload ? {
              source: 'api_content_filter',
              message: error.message,
              originalPrompt: errorObj.payload.originalPromptExcerpt,
              requestId: errorObj.payload.requestId,
              blockedCategories: errorObj.payload.blockedCategories,
              tokenSummary: errorObj.payload.tokenSummary,
              suggestions: errorObj.payload.suggestions,
              guidanceVersion: errorObj.payload.guidanceVersion || 'v2',
              schemaVersion: errorObj.payload.schemaVersion || 1,
            } : {
              source: 'api_content_filter',
              message: error.message,
              guidanceVersion: 'v2',
            };
            if (!payload.riskScore && payload.tokenSummary) {
              const total = Object.values(payload.tokenSummary).reduce((acc, v)=> acc + v.count, 0);
              payload.riskScore = Math.min(total / 12, 1); // heuristic normalization
              payload.riskBreakdown = Object.fromEntries(Object.entries(payload.tokenSummary).map(([k,v])=>[k, Math.min(v.count/5,1)*0.25]));
            }

            const modelName = await getModelFriendlyName();
            await CreateChatMessage({
              name: AI_NAME,
              content: error.message,
              role: "assistant",
              chatThreadId: props.chatThread.id,
              modelId: props.chatThread.modelId, // Pass the model ID
              modelName: modelName, // Pass the model friendly name
            });
            const imageBlockedEvent: AzureChatCompletionImageBlocked = {
              type: 'imageBlocked',
              response: payload,
            };
            streamResponse(imageBlockedEvent.type, JSON.stringify(imageBlockedEvent));
          } else {
            // Handle regular stream errors normally
            const response: AzureChatCompletion = {
              type: "error",
              response: error.message,
            };

            // if there is an error still save the last message even though it is not complete
            const modelName = await getModelFriendlyName();
            await CreateChatMessage({
              name: AI_NAME,
              content: lastMessage,
              role: "assistant",
              chatThreadId: props.chatThread.id,
              modelId: props.chatThread.modelId, // Pass the model ID
              modelName: modelName, // Pass the model friendly name
            });

            streamResponse(response.type, JSON.stringify(response));
          }
          try {
            if (!controller.desiredSize || controller.desiredSize > 0) {
              controller.close();
            }
          } catch (error) {
            console.warn("⚠️ Stream controller already closed on error");
          }
        })
        .on("finalContent", async (content: string) => {
          console.log("🟢 OpenAI Final Content:", content.substring(0, 200) + "...");
          
          const modelName = await getModelFriendlyName();
          await CreateChatMessage({
            name: AI_NAME,
            content: content,
            role: "assistant",
            chatThreadId: props.chatThread.id,
            modelId: props.chatThread.modelId, // Pass the model ID used to generate this message
            modelName: modelName, // Pass the model friendly name
          });

          const response: AzureChatCompletion = {
            type: "finalContent",
            response: content,
          };
          streamResponse(response.type, JSON.stringify(response));
          try {
            if (!controller.desiredSize || controller.desiredSize > 0) {
              controller.close();
            }
          } catch (error) {
            console.warn("⚠️ Stream controller already closed");
          }
        });
    },
  });

  return readableStream;
};

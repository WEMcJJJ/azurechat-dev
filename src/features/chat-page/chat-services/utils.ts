import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { ChatMessageModel } from "./models";

export const mapOpenAIChatMessages = (
  messages: ChatMessageModel[]
): ChatCompletionMessageParam[] => {
  return messages.map((message) => {
    switch (message.role) {
      case "function":
        // Convert deprecated 'function' role to 'assistant' role with proper formatting
        // This maintains backward compatibility with existing data
        return {
          role: "assistant",
          content: `Function result from ${message.name}: ${message.content}`,
        } as ChatCompletionAssistantMessageParam;
      case "assistant":
        return {
          role: message.role,
          content: message.content,
        } as ChatCompletionAssistantMessageParam;
      default:
        return {
          role: message.role,
          content: message.content,
        } as ChatCompletionMessageParam;
    }
  });
};

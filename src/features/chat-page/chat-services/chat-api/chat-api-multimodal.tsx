"use server";
import "server-only";

import { getOpenAIInstance } from "@/features/common/services/openai";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
import { ChatThreadModel } from "../models";
export const ChatApiMultimodal = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  file: string;
  signal: AbortSignal;
}): Promise<ChatCompletionStreamingRunner> => {
  const { chatThread, userMessage, signal, file } = props;

  const openAI = await getOpenAIInstance(chatThread.modelId);

  return openAI.beta.chat.completions.stream(
    {
      model: "",
      stream: true,
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            chatThread.personaMessage +
            "\n You are an expert in extracting insights from images that are uploaded to the chat. \n You will answer questions about the image that is provided.",
        },
        {
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
        },
      ],
    },
    { signal }
  );
};

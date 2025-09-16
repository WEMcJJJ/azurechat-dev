"use server";
import "server-only";

import { getOpenAIInstance } from "@/features/common/services/openai";

export const ChatApiText = async (
  userMessage: string,
  modelId?: string
) => {
  const openAI = await getOpenAIInstance(modelId);

  const response = await openAI.chat.completions.create({
    model: "",
    max_completion_tokens: 1000,
    stream: false,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userMessage }],
      },
    ],
  });

  return response.choices[0].message.content as string;
};

"use server";
import "server-only";

import { userHashedId } from "@/features/auth-page/helpers";
import { OpenAIInstance } from "@/features/common/services/openai";
import { RunnableToolFunction } from "openai/lib/RunnableFunction";
import {
  ChatCompletionStreamingRunner,
  ChatCompletionStreamParams,
} from "openai/resources/beta/chat/completions";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { SimilaritySearch } from "../azure-ai-search/azure-ai-search";
import { CreateCitations, FormatCitations } from "../citation-service";
import { ChatCitationModel, ChatThreadModel } from "../models";
import { reportPromptTokens } from "@/features/common/services/chat-metrics-service";
import { ChatTokenService } from "@/features/common/services/chat-token-service";

export const ChatApiRAG = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  history: ChatCompletionMessageParam[];
  signal: AbortSignal;
  extensions?: RunnableToolFunction<any>[];
}): Promise<ChatCompletionStreamingRunner> => {
  const { chatThread, userMessage, history, signal, extensions = [] } = props;

  const openAI = OpenAIInstance();

  const documentResponse = await SimilaritySearch(
    userMessage,
    5,
    `user eq '${await userHashedId()}' and chatThreadId eq '${chatThread.id}'`
  );

  const documents: ChatCitationModel[] = [];

  if (documentResponse.status === "OK") {
    const withoutEmbedding = FormatCitations(documentResponse.response);
    const citationResponse = await CreateCitations(withoutEmbedding);

    citationResponse.forEach((c) => {
      if (c.status === "OK") {
        documents.push(c.response);
      }
    });
  }

  const content = documents
    .map((result, index) => {
      const content = result.content.document.pageContent;
      const context = `[${index}]. file name: ${result.content.document.metadata} \n file id: ${result.id} \n ${content}`;
      return context;
    })
    .join("\n------\n");
  
  // Augment the user prompt
  let _userMessage = "";
  
  if (documents.length === 0) {
    // No relevant documents found - inform user and answer from general knowledge
    _userMessage = `Note: No directly relevant content found in your uploaded documents for this question. Answering from general knowledge.\n\nQuestion: ${userMessage}`;
  } else {
    // Documents found - provide them as supplementary context
    _userMessage = `\nThe user has uploaded documents to this conversation. Below are relevant excerpts that may help answer their question:\n
----------------
Document Content:
${content}
\n
----------------\n
Instructions:
- Use the document content above when it's relevant to the question
- You can and should also use your general knowledge and reasoning abilities to provide comprehensive answers
- Feel free to combine information from the documents with your broader knowledge when helpful
- Include a citation at the end of your answer ONLY when you directly reference content from the uploaded documents
- Use this format for citations: {% citation items=[{name:"filename",id:"file id"}] /%}
- For questions that don't relate to the documents, or when using only general knowledge, no citation is needed\n
Question: ${userMessage}
`;
  }

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: chatThread.personaMessage +
        "\n You also have access to image generation tools (create_img, edit_img) to create or edit images when requested.",
    },
    ...history,
    {
      role: "user",
      content: _userMessage,
    },
  ];

  let chatTokenService = new ChatTokenService();

  let promptTokens = chatTokenService.getTokenCountFromHistory(messages);

  for (let tokens of promptTokens) {
    reportPromptTokens(tokens.tokens, "gpt-4", tokens.role, { personaMessageTitle: chatThread.personaMessageTitle, messageCount: messages.length, threadId: chatThread.id });
  }

  // If extensions are provided, use runTools to enable function calling
  if (extensions && extensions.length > 0) {
    return openAI.beta.chat.completions.runTools(
      {
        model: "",
        stream: true,
        messages: messages,
        tools: extensions,
      },
      { signal }
    );
  }

  // No extensions - use standard streaming
  const stream: ChatCompletionStreamParams = {
    model: "",
    stream: true,
    messages: messages,
  };

  return openAI.beta.chat.completions.stream(stream, { signal });
};

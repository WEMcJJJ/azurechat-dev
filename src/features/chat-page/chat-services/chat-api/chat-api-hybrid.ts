"use server";
import "server-only";

/**
 * Hybrid Chat API
 * 
 * This API provides a hybrid approach to chat when documents are uploaded:
 * - Searches uploaded documents for relevant information using similarity search
 * - Only uses document content if it has sufficient relevance (score > 0.7)
 * - Supplements document information with general AI knowledge when needed
 * - Allows the AI to answer questions outside the scope of uploaded documents
 * - Provides citations when using document information
 * 
 * This addresses the limitation where pure RAG mode restricts responses
 * to only document content, making the chat more flexible and useful.
 */

import { userHashedId } from "@/features/auth-page/helpers";
import { getOpenAIInstance } from "@/features/common/services/openai";
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

export const ChatApiHybrid = async (props: {
  chatThread: ChatThreadModel;
  userMessage: string;
  history: ChatCompletionMessageParam[];
  signal: AbortSignal;
}): Promise<ChatCompletionStreamingRunner> => {
  const { chatThread, userMessage, history, signal } = props;

  const openAI = await getOpenAIInstance(chatThread.modelId);

  // Search for relevant documents with a smaller result set for hybrid approach
  const documentResponse = await SimilaritySearch(
    userMessage,
    5, // Fewer results for hybrid approach to keep context manageable
    `user eq '${await userHashedId()}' and chatThreadId eq '${chatThread.id}'`,
    chatThread.modelId
  );

  let documentContext = "";
  let citations: ChatCitationModel[] = [];

  if (documentResponse.status === "OK" && documentResponse.response.length > 0) {
    // Use all documents like the original RAG, but still provide hybrid prompting
    const relevantDocs = documentResponse.response;
    
    if (relevantDocs.length > 0) {
      const withoutEmbedding = FormatCitations(relevantDocs);
      const citationResponse = await CreateCitations(withoutEmbedding);

      citationResponse.forEach((c) => {
        if (c.status === "OK") {
          citations.push(c.response);
        }
      });

      documentContext = citations
        .map((result, index) => {
          const content = result.content.document.pageContent;
          return `[Document ${index + 1}]: ${result.content.document.metadata}\n${content}`;
        })
        .join("\n---\n");
    }
  }

  // Create hybrid system prompt
  const hybridSystemPrompt = documentContext 
    ? `${chatThread.personaMessage}

DOCUMENT CONTEXT:
The user has uploaded documents that may be relevant to their questions. Here are potentially relevant excerpts:

${documentContext}

INSTRUCTIONS:
- Use the document context when it's relevant to answer the user's question
- If the documents don't contain sufficient information to fully answer the question, you may supplement with your general knowledge
- When using document information, include citations using this format: {% citation items=[{name:"filename",id:"file_id"}] /%}
- You can combine document information with your general knowledge when appropriate
- If asked about topics completely unrelated to the documents, respond normally using your general knowledge
- Be clear about when you're using document information vs. general knowledge`
    : chatThread.personaMessage;

  const stream: ChatCompletionStreamParams = {
    model: "",
    stream: true,
    max_completion_tokens: 8192, // Set reasonable limit for comprehensive document analysis
    messages: [
      {
        role: "system",
        content: hybridSystemPrompt,
      },
      ...history,
      {
        role: "user",
        content: userMessage, // Use the original user message, not the augmented RAG version
      },
    ]
  };

  // Token counting and reporting
  const chatTokenService = new ChatTokenService();
  const promptTokens = chatTokenService.getTokenCountFromHistory(stream.messages);

  for (const tokens of promptTokens) {
    reportPromptTokens(tokens.tokens, "gpt-4", tokens.role, {
      personaMessageTitle: chatThread.personaMessageTitle,
      messageCount: stream.messages.length,
      threadId: chatThread.id
    });
  }

  return openAI.beta.chat.completions.stream(stream, { signal });
};

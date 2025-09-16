"use server";
import "server-only";

import { getCurrentUser } from "@/features/auth-page/helpers";
import { CHAT_DEFAULT_SYSTEM_PROMPT } from "@/features/theme/theme-config";
import { ChatCompletionStreamingRunner } from "openai/resources/beta/chat/completions";
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
import { AzureChatCompletionImageBlocked } from "../models";
import {
  reportCompletionTokens,
  reportUserChatMessage,
} from "../../../common/services/chat-metrics-service";
import { ChatTokenService } from "@/features/common/services/chat-token-service";
import { getModelConfigForThread } from "@/server/services/aoaiClientFactory";
import { checkModelSetup } from "@/server/services/modelSetupService";
import { ChatApiHybrid } from "./chat-api-hybrid";
type ChatTypes = "extensions" | "multimodal" | "hybrid";

export const ChatAPIEntry = async (props: UserPrompt, signal: AbortSignal) => {
  // Check if models are configured before allowing chat
  const modelSetup = await checkModelSetup();
  if (modelSetup.isSetupRequired) {
    return new Response("Models not configured", { status: 503 });
  }

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

  // Helper function to get model friendly name
  const getModelFriendlyName = async (): Promise<string | undefined> => {
    try {
      if (currentChatThread.modelId) {
        const modelConfig = await getModelConfigForThread(currentChatThread.modelId);
        return modelConfig?.friendlyName;
      }
    } catch (error) {
      console.warn("Failed to get model friendly name:", error);
    }
    return undefined;
  };

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
  // Starting values for system and user prompt
  // Note that the system message will also get prepended with the extension execution steps. Please see ChatApiExtensions method.
  currentChatThread.personaMessage = `${CHAT_DEFAULT_SYSTEM_PROMPT} \n\n ${currentChatThread.personaMessage}`;

  let chatType: ChatTypes = "extensions";

  if (props.multimodalImage && props.multimodalImage.length > 0) {
    chatType = "multimodal";
  } else if (docs.length > 0) {
    chatType = "hybrid"; // Use hybrid mode instead of pure RAG
  } else if (extension.length > 0) {
    chatType = "extensions";
  }

  // Pre-validation: detect strong image intent & high-risk lexical tokens to optionally short-circuit
  const userLower = props.message.toLowerCase();
  const imageIntent = /(generate|create|make|draw|design|produce)\s+(an?\s+)?(image|picture|logo|icon|illustration|art|artwork)|\bimage of\b|\billustration of\b/.test(userLower);
  const riskTokens = {
    violence: ['blood','bloody','gore','gory','decapitated','severed','disemboweled','corpse','zombie','kill','killing'],
    sexual: ['nude','nudity','naked','sexual','erotic','fetish'],
    hate: ['nazi','terrorist','genocide','supremacist','racist'],
    self_harm: ['suicide','self-harm','self harm','kill myself']
  } as const;
  const detected: Record<string,string[]> = {};
  if (imageIntent) {
    Object.entries(riskTokens).forEach(([cat, list]) => {
      const hits = list.filter(t => userLower.includes(t));
      if (hits.length) detected[cat] = hits.slice(0,5);
    });
  }
  // Compute a simple risk score: each category contributes up to 0.25 scaled by token count / 5 (cap)
  let riskScore = 0;
  const riskBreakdown: Record<string, number> = {};
  Object.entries(detected).forEach(([cat, tokens]) => {
    const contribution = Math.min(tokens.length / 5, 1) * 0.25; // cap per category
    riskBreakdown[cat] = parseFloat(contribution.toFixed(3));
    riskScore += contribution;
  });
  riskScore = parseFloat(Math.min(riskScore, 1).toFixed(3));
  const threshold = parseFloat(process.env.IMAGE_PREVALIDATION_RISK_THRESHOLD || '0.45');
  const tokenMultiplicityTrigger = Object.values(detected).some(arr => arr.length >= 2);
  const preValidationHighRisk = imageIntent && (riskScore >= threshold || tokenMultiplicityTrigger);

  if (preValidationHighRisk) {
    // Early imageBlocked emission bypassing model call to save tokens
    const guidance = "🚫 **Potentially unsafe image request (pre-validation)**\n\nThe prompt contains multiple high-risk terms likely to trigger the image safety filter. Please soften or remove them before retrying.";
    const suggestions: string[] = [];
    if (detected.violence) suggestions.push("Violence: reduce graphic or gory terms");
    if (detected.sexual) suggestions.push("Sexual: remove sexual descriptors");
    if (detected.hate) suggestions.push("Hate: remove extremist/hate references");
    if (detected.self_harm) suggestions.push("Self-harm: remove self-injury references");
  // (sanitized prompt workflow removed per product decision)
  const payload: AzureChatCompletionImageBlocked = {
      type: 'imageBlocked',
      response: {
        source: 'pre_validation',
  message: guidance + `\n\nDetected: ${Object.entries(detected).map(([k,v])=>`${k}(${v.join(', ')})`).join('; ')}`,
        originalPrompt: props.message.slice(0,240),
        blockedCategories: Object.keys(detected),
        tokenSummary: Object.fromEntries(Object.entries(detected).map(([k,v])=>[k,{count:v.length,samples:v}])) ,
        suggestions,
        guidanceVersion: 'v2',
        schemaVersion: 1,
    riskScore,
    riskBreakdown,
      }
    };
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`event: imageBlocked \n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)} \n\n`));
        controller.close();
      }
    });
    // Persist user message first for continuity
    await CreateChatMessage({
      name: user?.name || 'user',
      content: props.message,
      role: 'user',
      chatThreadId: currentChatThreadResponse.response.id,
      multiModalImage: props.multimodalImage,
    });
    const modelName = await getModelFriendlyName();
    await CreateChatMessage({
      name: 'system',
      content: guidance,
      role: 'assistant',
      chatThreadId: currentChatThreadResponse.response.id,
      multiModalImage: '',
      modelId: currentChatThread.modelId,
      modelName: modelName,
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive' } });
  }

  // save the user message
  await CreateChatMessage({
    name: user.name,
    content: props.message,
    role: "user",
    chatThreadId: currentChatThread.id,
    multiModalImage: props.multimodalImage,
  });

  let runner: ChatCompletionStreamingRunner;

  switch (chatType) {
    case "hybrid":
      runner = await ChatApiHybrid({
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
        file: props.multimodalImage,
        signal: signal,
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
    default:
      // Fallback to extensions if no specific case matches
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
    return mapOpenAIChatMessages(historyResults).reverse();
  }

  console.error("🔴 Error on getting history:", historyResponse.errors);

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
    extensionIds: props.chatThread.extension || [],
  });
  if (
    dynamicExtensionsResponse.status === "OK" &&
    dynamicExtensionsResponse.response.length > 0
  ) {
    extension.push(...dynamicExtensionsResponse.response);
  }

  return extension;
};

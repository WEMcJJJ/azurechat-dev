"use server";
import "server-only";

import {
  getCurrentUser,
  userHashedId,
  userSession,
} from "@/features/auth-page/helpers";
import { RevalidateCache } from "@/features/common/navigation-helpers";
import { ServerActionResponse } from "@/features/common/server-action-response";
import { uniqueId } from "@/features/common/util";
import {
  CHAT_DEFAULT_PERSONA,
  NEW_CHAT_NAME,
} from "@/features/theme/theme-config";
import { SqlQuerySpec } from "@azure/cosmos";
import { HistoryContainer } from "../../common/services/cosmos";
import { DeleteDocumentsOfChatThread } from "./azure-ai-search/azure-ai-search";
import { FindAllChatDocuments } from "./chat-document-service";
import { FindAllChatMessagesForCurrentUser } from "./chat-message-service";
import {
  CHAT_THREAD_ATTRIBUTE,
  ChatDocumentModel,
  ChatThreadModel,
} from "./models";
import { redirect } from "next/navigation";
import { ChatApiText } from "./chat-api/chat-api-text";
import { getDefaultModel } from "@/server/repositories/modelRepository";

export const FindAllChatThreadForCurrentUser = async (): Promise<
  ServerActionResponse<Array<ChatThreadModel>>
> => {
  try {
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.userId=@userId AND r.isDeleted=@isDeleted ORDER BY r.createdAt DESC",
      parameters: [
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
        },
        {
          name: "@userId",
          value: await userHashedId(),
        },
        {
          name: "@isDeleted",
          value: false,
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<ChatThreadModel>(querySpec, {
        partitionKey: await userHashedId(),
      })
      .fetchAll();

    return {
      status: "OK",
      response: resources,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const FindChatThreadForCurrentUser = async (
  id: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const hashedUserId = await userHashedId();
    
    // First attempt: Direct item read (stronger consistency)
    try {
      console.log(`🔍 Attempting direct read for chat thread: ${id}`);
      const { resource } = await HistoryContainer().item(id, hashedUserId).read<ChatThreadModel>();
      
      if (resource && 
          resource.type === CHAT_THREAD_ATTRIBUTE && 
          resource.userId === hashedUserId && 
          !resource.isDeleted) {
        console.log(`✅ Direct read successful, imageModelId: ${resource.imageModelId}, modelId: ${resource.modelId}`);
        return {
          status: "OK",
          response: resource,
        };
      }
    } catch (directReadError) {
      console.log(`ℹ️ Direct read failed, falling back to query:`, directReadError);
    }

    // Fallback: Query (eventual consistency)
    const querySpec: SqlQuerySpec = {
      query:
        "SELECT * FROM root r WHERE r.type=@type AND r.userId=@userId AND r.id=@id AND r.isDeleted=@isDeleted",
      parameters: [
        {
          name: "@type",
          value: CHAT_THREAD_ATTRIBUTE,
        },
        {
          name: "@userId",
          value: hashedUserId,
        },
        {
          name: "@id",
          value: id,
        },
        {
          name: "@isDeleted",
          value: false,
        },
      ],
    };

    const { resources } = await HistoryContainer()
      .items.query<ChatThreadModel>(querySpec)
      .fetchAll();

    if (resources.length === 0) {
      return {
        status: "NOT_FOUND",
        errors: [{ message: `Chat thread not found` }],
      };
    }

    const chatThread = resources[0];
    console.log(`📋 Query read successful, imageModelId: ${chatThread.imageModelId}, modelId: ${chatThread.modelId}`);

    return {
      status: "OK",
      response: chatThread,
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const SoftDeleteChatThreadForCurrentUser = async (
  chatThreadID: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const chatThreadResponse = await FindChatThreadForCurrentUser(chatThreadID);

    if (chatThreadResponse.status === "OK") {
      const chatResponse = await FindAllChatMessagesForCurrentUser(
        chatThreadID
      );

      if (chatResponse.status !== "OK") {
        return chatResponse;
      }
      const chats = chatResponse.response;

      chats.forEach(async (chat) => {
        const itemToUpdate = {
          ...chat,
        };
        itemToUpdate.isDeleted = true;
        await HistoryContainer().items.upsert(itemToUpdate);
      });

      const chatDocumentsResponse = await FindAllChatDocuments(chatThreadID);

      if (chatDocumentsResponse.status !== "OK") {
        return chatDocumentsResponse;
      }

      const chatDocuments = chatDocumentsResponse.response;

      if (chatDocuments.length !== 0) {
        await DeleteDocumentsOfChatThread(chatThreadID);
      }

      chatDocuments.forEach(async (chatDocument: ChatDocumentModel) => {
        const itemToUpdate = {
          ...chatDocument,
        };
        itemToUpdate.isDeleted = true;
        await HistoryContainer().items.upsert(itemToUpdate);
      });

      chatThreadResponse.response.isDeleted = true;
      await HistoryContainer().items.upsert(chatThreadResponse.response);
    }

    return chatThreadResponse;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const SoftDeleteChatDocumentsForCurrentUser = async (
  chatThreadId: string
): Promise<ServerActionResponse> => {
  try {
    const chatDocumentsResponse = await FindAllChatDocuments(chatThreadId);

    if (chatDocumentsResponse.status !== "OK") {
      return chatDocumentsResponse;
    }

    const chatDocuments = chatDocumentsResponse.response;

    if (chatDocuments.length !== 0) {
      await DeleteDocumentsOfChatThread(chatThreadId);
    }

    chatDocuments.forEach(async (chatDocument: ChatDocumentModel) => {
      const itemToUpdate = {
        ...chatDocument,
      };
      itemToUpdate.isDeleted = true;
      await HistoryContainer().items.upsert(itemToUpdate);
    });

    return {
      status: "OK",
      response: "OK",
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const EnsureChatThreadOperation = async (
  chatThreadID: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  const response = await FindChatThreadForCurrentUser(chatThreadID);
  const currentUser = await getCurrentUser();
  const hashedId = await userHashedId();

  if (response.status === "OK") {
    if (currentUser.isAdmin || response.response.userId === hashedId) {
      return response;
    }
  }

  return response;
};

export const AddExtensionToChatThread = async (props: {
  chatThreadId: string;
  extensionId: string;
}): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const response = await FindChatThreadForCurrentUser(props.chatThreadId);
    if (response.status === "OK") {
      const chatThread = response.response;

      const existingExtension = chatThread.extension.find(
        (e) => e === props.extensionId
      );

      if (existingExtension === undefined) {
        chatThread.extension.push(props.extensionId);
        return await UpsertChatThread(chatThread);
      }

      return {
        status: "OK",
        response: chatThread,
      };
    }

    return response;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const RemoveExtensionFromChatThread = async (props: {
  chatThreadId: string;
  extensionId: string;
}): Promise<ServerActionResponse<ChatThreadModel>> => {
  const response = await FindChatThreadForCurrentUser(props.chatThreadId);
  if (response.status === "OK") {
    const chatThread = response.response;
    chatThread.extension = chatThread.extension.filter(
      (e) => e !== props.extensionId
    );

    return await UpsertChatThread(chatThread);
  }

  return response;
};

export const UpdateChatThreadTimestamp = async (
  chatThreadId: string
): Promise<void> => {
  try {
    const chatThreadResponse = await FindChatThreadForCurrentUser(chatThreadId);
    
    if (chatThreadResponse.status === "OK") {
      const chatThread = chatThreadResponse.response;
      chatThread.lastMessageAt = new Date();
      await UpsertChatThread(chatThread);
    }
  } catch (error) {
    console.warn("Failed to update chat thread timestamp:", error);
    // Don't throw - we don't want message creation to fail just because timestamp update failed
  }
};

export const UpsertChatThread = async (
  chatThread: ChatThreadModel
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    if (chatThread.id) {
      const response = await EnsureChatThreadOperation(chatThread.id);
      if (response.status !== "OK") {
        return response;
      }
    }

    // Only update lastMessageAt if it's not already set (for new threads)
    if (!chatThread.lastMessageAt) {
      chatThread.lastMessageAt = new Date();
    }

    // Ensure extension property is always an array (migration for existing threads)
    if (!Array.isArray(chatThread.extension)) {
      chatThread.extension = [];
    }
    
    const { resource } = await HistoryContainer().items.upsert<ChatThreadModel>(
      chatThread
    );

    if (resource) {
      return {
        status: "OK",
        response: resource,
      };
    }

    return {
      status: "ERROR",
      errors: [{ message: `Chat thread not found` }],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const UpdateChatThreadModel = async (
  chatThreadId: string,
  modelId: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const chatThreadResponse = await FindChatThreadForCurrentUser(chatThreadId);
    
    if (chatThreadResponse.status !== "OK") {
      return chatThreadResponse;
    }

    const chatThread = chatThreadResponse.response;
    chatThread.modelId = modelId;

    return await UpsertChatThread(chatThread);
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `Failed to update chat thread model: ${error}` }],
    };
  }
};

export const UpdateChatThreadImageModel = async (
  chatThreadId: string,
  imageModelId: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    console.log(`🔧 UpdateChatThreadImageModel called: ${chatThreadId} -> ${imageModelId}`);
    
    const chatThreadResponse = await FindChatThreadForCurrentUser(chatThreadId);
    
    if (chatThreadResponse.status !== "OK") {
      console.log(`❌ Failed to find chat thread: ${chatThreadResponse.status}`);
      return chatThreadResponse;
    }

    const chatThread = chatThreadResponse.response;
    console.log(`📝 Before update - imageModelId: ${chatThread.imageModelId}`);
    
    chatThread.imageModelId = imageModelId;
    console.log(`📝 After update - imageModelId: ${chatThread.imageModelId}`);

    const result = await UpsertChatThread(chatThread);
    console.log(`💾 UpsertChatThread result: ${result.status}`);
    
    return result;
  } catch (error) {
    console.error(`❌ UpdateChatThreadImageModel error:`, error);
    return {
      status: "ERROR",
      errors: [{ message: `Failed to update chat thread image model: ${error}` }],
    };
  }
};

export const CreateChatThread = async (): Promise<
  ServerActionResponse<ChatThreadModel>
> => {
  try {
    // Get the default model ID
    let defaultModelId: string | undefined;
    try {
      const defaultModelResponse = await getDefaultModel();
      if (defaultModelResponse.status === "OK") {
        defaultModelId = defaultModelResponse.response.id;
      }
    } catch (error) {
      console.warn("Failed to get default model for new chat thread:", error);
      // Continue without model ID - will use environment fallback if enabled
    }

    const modelToSave: ChatThreadModel = {
      name: NEW_CHAT_NAME,
      useName: (await userSession())!.name,
      userId: await userHashedId(),
      id: uniqueId(),
      createdAt: new Date(),
      lastMessageAt: new Date(),
      bookmarked: false,
      isDeleted: false,
      type: CHAT_THREAD_ATTRIBUTE,
      personaMessage: "",
      personaMessageTitle: CHAT_DEFAULT_PERSONA,
      extension: [],
      modelId: defaultModelId,
    };

    const { resource } = await HistoryContainer().items.create<ChatThreadModel>(
      modelToSave
    );
    if (resource) {
      return {
        status: "OK",
        response: resource,
      };
    }

    return {
      status: "ERROR",
      errors: [{ message: `Chat thread not found` }],
    };
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const UpdateChatTitle = async (
  chatThreadId: string,
  prompt: string
): Promise<ServerActionResponse<ChatThreadModel>> => {
  try {
    const response = await FindChatThreadForCurrentUser(chatThreadId);
    const shorterPrompt = prompt.slice(0, 300);
    if (response.status === "OK") {
      const chatThread = response.response;
      const systemPrompt = `- you will generate a short title based on the first message a user begins a conversation with
                            - ensure it is not more than 40 characters long
                            - the title should be a summary or keywords of the user's message
                            - do not use quotes or colons
                            USERPROMPT: ${shorterPrompt}`;

      chatThread.name = await ChatApiText(systemPrompt);

      return await UpsertChatThread(chatThread);
    }
    return response;
  } catch (error) {
    return {
      status: "ERROR",
      errors: [{ message: `${error}` }],
    };
  }
};

export const CreateChatAndRedirect = async () => {
  const response = await CreateChatThread();
  if (response.status === "OK") {
    // Revalidate the chat layout cache so the new chat appears in the sidebar
    RevalidateCache({
      page: "chat",
      type: "layout",
    });
    redirect(`/chat/${response.response.id}`);
  }
};

"use client";
import { Alert, AlertDescription, AlertTitle } from "@/features/ui/alert";
import { AlertCircle } from "lucide-react";
import { ChatInput } from "@/features/chat-page/chat-input/chat-input";
import { chatStore, useChat } from "@/features/chat-page/chat-store";
import { ChatLoading } from "@/features/ui/chat/chat-message-area/chat-loading";
import { ChatMessageArea } from "@/features/ui/chat/chat-message-area/chat-message-area";
import ChatMessageContainer from "@/features/ui/chat/chat-message-area/chat-message-container";
import ChatMessageContentArea from "@/features/ui/chat/chat-message-area/chat-message-content";
import { useChatScrollAnchor } from "@/features/ui/chat/chat-message-area/use-chat-scroll-anchor";
import { useSession } from "next-auth/react";
import { FC, useEffect, useRef, useState } from "react";
import { ExtensionModel } from "../extensions-page/extension-services/models";
import { ChatHeader } from "./chat-header/chat-header";
import {
  ChatDocumentModel,
  ChatMessageModel,
  ChatThreadModel,
} from "./chat-services/models";
import MessageContent from "./message-content";
import { UpdateChatThreadModel } from "./chat-services/chat-thread-service";
import { showError, showSuccess } from "@/features/globals/global-message-store";
import { RevalidateCache } from "@/features/common/navigation-helpers";
import { ImageModelProvider } from "@/features/image/context/image-model-context";

interface ChatPageProps {
  messages: Array<ChatMessageModel>;
  chatThread: ChatThreadModel;
  chatDocuments: Array<ChatDocumentModel>;
  extensions: Array<ExtensionModel>;
}

export const ChatPage: FC<ChatPageProps> = (props) => {
  const { data: session } = useSession();
  const [currentChatThread, setCurrentChatThread] = useState<ChatThreadModel>(props.chatThread);
  const [currentModelName, setCurrentModelName] = useState<string>("");

  // Get current model name for immediate display on streaming messages
  useEffect(() => {
    const getCurrentModelName = async () => {
      if (currentChatThread.modelId) {
        try {
          const { getModelConfigForThread } = await import("@/server/services/aoaiClientFactory");
          const modelConfig = await getModelConfigForThread(currentChatThread.modelId);
          if (modelConfig?.friendlyName) {
            setCurrentModelName(modelConfig.friendlyName);
          }
        } catch (error) {
          console.warn("Failed to get current model name:", error);
        }
      }
    };
    getCurrentModelName();
  }, [currentChatThread.modelId]);

  useEffect(() => {
    chatStore.initChatSession({
      chatThread: currentChatThread,
      messages: props.messages,
      userName: session?.user?.name!,
    });
  }, [props.messages, session?.user?.name, currentChatThread]);

  const { messages, loading } = useChat();

  const current = useRef<HTMLDivElement>(null);

  const maxMessages = 40;

  useChatScrollAnchor({ ref: current });

  // Handle model selection change
  const handleModelChange = async (modelId: string) => {
    try {
      const response = await UpdateChatThreadModel(currentChatThread.id, modelId);
      
      if (response.status === "OK") {
        // Update the local state
        setCurrentChatThread({
          ...currentChatThread,
          modelId: modelId
        });
        
        showSuccess({
          title: "Model Updated",
          description: "Chat model has been updated successfully."
        });

        // Revalidate the cache to update other components
        RevalidateCache({
          page: "chat",
          type: "layout",
        });
      } else {
        showError(response.errors?.map(e => e.message).join(", ") || "Failed to update model");
      }
    } catch (error) {
      console.error("Failed to update chat thread model:", error);
      showError("Failed to update chat model. Please try again.");
    }
  };

  const handleImageModelUpdate = (imageModelId: string) => {
    // Update the current chat thread state when image model changes
    setCurrentChatThread(prev => ({
      ...prev,
      imageModelId
    }));
  };

  return (
    <ImageModelProvider 
      chatThreadId={currentChatThread.id} 
      initialImageModel={currentChatThread.imageModelId}
      onImageModelUpdate={handleImageModelUpdate}
    >
      <main className="flex flex-1 relative flex-col px-3">
        <ChatHeader
          chatThread={currentChatThread}
          chatDocuments={props.chatDocuments}
          extensions={props.extensions}
          onModelChange={handleModelChange}
        />

        {messages.length > maxMessages && (
          <Alert className="text-x bg-primary bg-orange-400">
            <AlertCircle size={20} />
            <AlertTitle>Warning: Too Many Messages</AlertTitle>
            <AlertDescription className="text">
              This chat has more than {maxMessages} messages. Long chats cost more
              money because the whole context with all messages is sent to the LLM
              when clicking on submit. Please open a new chat whenever the context
              or topic switches.
            </AlertDescription>
          </Alert>
        )}
        <ChatMessageContainer ref={current}>
          <ChatMessageContentArea>
            {messages.map((message) => {
              return (
                <ChatMessageArea
                  key={message.id}
                  profileName={message.name}
                  role={message.role}
                  onCopy={() => {
                    navigator.clipboard.writeText(message.content);
                  }}
                  profilePicture={session?.user?.image}
                  modelId={message.modelId} // Keep for legacy messages
                  modelName={message.modelName || (message.role === "assistant" ? currentModelName : undefined)} // Use stored model name or current thread model name
                >
                  <MessageContent message={message} />
                </ChatMessageArea>
              );
            })}
            {loading === "loading" && <ChatLoading />}
          </ChatMessageContentArea>
        </ChatMessageContainer>
        <ChatInput
          chatDocuments={props.chatDocuments}
          internetSearch={props.extensions.find((e) => e.name == "Bing Search")}
          threadExtensions={props.chatThread.extension}
        />
      </main>
    </ImageModelProvider>
  );
};

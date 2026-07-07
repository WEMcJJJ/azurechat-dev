"use client";
import { uniqueId } from "@/features/common/util";
import { showError } from "@/features/globals/global-message-store";
import { AI_NAME, NEW_CHAT_NAME } from "@/features/theme/theme-config";
import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from "eventsource-parser";
import { FormEvent } from "react";
import { proxy, useSnapshot } from "valtio";
import { RevalidateCache } from "../common/navigation-helpers";
import { InputImageStore } from "../ui/chat/chat-input-area/input-image-store";
import { textToSpeechStore } from "./chat-input/speech/use-text-to-speech";
import { ResetInputRows } from "./chat-input/use-chat-input-dynamic-height";
import {
  AddExtensionToChatThread,
  RemoveExtensionFromChatThread,
  UpdateChatTitle,
} from "./chat-services/chat-thread-service";
import { isImageToolResult } from "@/types/image-generation";
import {
  AzureChatCompletion,
  ChatMessageModel,
  ChatThreadModel,
} from "./chat-services/models";
let abortController: AbortController = new AbortController();

type chatStatus = "idle" | "loading" | "file upload";

class ChatState {
  public messages: Array<ChatMessageModel> = [];
  public loading: chatStatus = "idle";
  public input: string = "";
  public lastMessage: string = "";
  public autoScroll: boolean = false;
  public userName: string = "";
  public chatThreadId: string = "";

  private chatThread: ChatThreadModel | undefined;

  private addToMessages(message: ChatMessageModel) {
    const currentMessage = this.messages.find((el) => el.id === message.id);
    if (currentMessage) {
      currentMessage.content = message.content;
    } else {
      this.messages.push(message);
    }
  }

  private removeMessage(id: string) {
    const index = this.messages.findIndex((el) => el.id === id);
    if (index > -1) {
      this.messages.splice(index, 1);
    }
  }

  public updateLoading(value: chatStatus) {
    this.loading = value;
  }

  public initChatSession({
    userName,
    messages,
    chatThread,
  }: {
    chatThread: ChatThreadModel;
    userName: string;
    messages: Array<ChatMessageModel>;
  }) {
    this.chatThread = chatThread;
    this.chatThreadId = chatThread.id;
    this.messages = messages;
    this.userName = userName;
  }

  public async AddExtensionToChatThread(extensionId: string) {
    this.loading = "loading";

    const response = await AddExtensionToChatThread({
      extensionId: extensionId,
      chatThreadId: this.chatThreadId,
    });
    RevalidateCache({
      page: "chat",
      type: "layout",
    });

    if (response.status !== "OK") {
      showError(response.errors[0].message);
    }

    this.loading = "idle";
  }

  public async RemoveExtensionFromChatThread(extensionId: string) {
    this.loading = "loading";

    const response = await RemoveExtensionFromChatThread({
      extensionId: extensionId,
      chatThreadId: this.chatThreadId,
    });

    RevalidateCache({
      page: "chat",
    });

    if (response.status !== "OK") {
      showError(response.errors[0].message);
    }

    this.loading = "idle";
  }

  public updateInput(value: string) {
    this.input = value;
  }

  public stopGeneratingMessages() {
    abortController.abort();
  }

  public updateAutoScroll(value: boolean) {
    this.autoScroll = value;
  }

  private reset() {
    this.input = "";
    ResetInputRows();
    InputImageStore.Reset();
  }

  private async chat(formData: FormData) {
    this.updateAutoScroll(true);
    this.loading = "loading";

    const multimodalImage = formData.get("image-base64") as unknown as string;

    const newUserMessage: ChatMessageModel = {
      id: uniqueId(),
      role: "user",
      content: this.input,
      name: this.userName,
      multiModalImage: multimodalImage,
      createdAt: new Date(),
      isDeleted: false,
      threadId: this.chatThreadId,
      type: "CHAT_MESSAGE",
      userId: "",
    };

    this.messages.push(newUserMessage);
    this.reset();

    const controller = new AbortController();
    abortController = controller;

    try {
      if (this.chatThreadId === "" || this.chatThreadId === undefined) {
        showError("Chat thread ID is empty");
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (response.body) {
        const parser = this.createStreamParser(newUserMessage);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;

          const chunkValue = decoder.decode(value);
          parser.feed(chunkValue);
        }
        this.loading = "idle";
      }
    } catch (error) {
      showError("" + error);
      this.loading = "idle";
    }
  }

  private async updateTitle() {
    if (this.chatThread && this.chatThread.name === NEW_CHAT_NAME) {
      await UpdateChatTitle(this.chatThreadId, this.messages[0].content);
      RevalidateCache({
        page: "chat",
        type: "layout",
      });
    }
  }

  private completed(message: string) {
    textToSpeechStore.speak(message);
  }

  public async submitChat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (this.input === "" || this.loading !== "idle") {
      return;
    }

    // get form data from e
    const formData = new FormData(e.currentTarget);

    const body = JSON.stringify({
      id: this.chatThreadId,
      message: this.input,
    });
    formData.append("content", body);

    this.chat(formData);
  }

  private createStreamParser(newUserMessage: ChatMessageModel) {
    let currentFunctionName: string | null = null; // Track function name for tool results
    
    return createParser((event: ParsedEvent | ReconnectInterval) => {
      if (event.type === "event") {
        const responseType = JSON.parse(event.data) as AzureChatCompletion;
        switch (responseType.type) {
          case "functionCall":
            // Save the function name for the upcoming result
            currentFunctionName = responseType.response.name;
            
            const mappedFunction: ChatMessageModel = {
              id: uniqueId(),
              content: responseType.response.arguments,
              name: responseType.response.name,
              role: "function",
              createdAt: new Date(),
              isDeleted: false,
              threadId: this.chatThreadId,
              type: "CHAT_MESSAGE",
              userId: "",
              multiModalImage: "",
            };
            this.addToMessages(mappedFunction);
            break;
          case "functionCallResult":
            const mappedFunctionResult: ChatMessageModel = {
              id: uniqueId(),
              content: responseType.response,
              name: "tool", // Use "tool" to differentiate from function calls (matches DALL-E 3)
              role: "tool",
              createdAt: new Date(),
              isDeleted: false,
              threadId: this.chatThreadId,
              type: "CHAT_MESSAGE",
              userId: "",
              multiModalImage: "",
              hiddenToolResult: false, // Show tool results
            };
            this.addToMessages(mappedFunctionResult);
            
            // Add progress notification for single-image generations
            try {
              const parsedResult = JSON.parse(responseType.response);
              if (isImageToolResult(parsedResult) && parsedResult.urls.length === 1) {
                const progressMessage: ChatMessageModel = {
                  id: uniqueId(),
                  content: `✓ Generated: ${parsedResult.context.prompt}`,
                  name: "system",
                  role: "system",
                  createdAt: new Date(),
                  isDeleted: false,
                  threadId: this.chatThreadId,
                  type: "CHAT_MESSAGE",
                  userId: "",
                  multiModalImage: "",
                  isProgressMessage: true,
                  progressFailed: false,
                };
                this.addToMessages(progressMessage);
              }
            } catch {
              // Not a parseable image result, skip progress message
            }
            break;
          case "content":
            // Remove progress messages when assistant starts responding
            this.messages = this.messages.filter(
              (msg) => !msg.isProgressMessage
            );
            
            const mappedContent: ChatMessageModel = {
              id: responseType.response.id,
              content: responseType.response.choices[0].message.content || "",
              name: AI_NAME,
              role: "assistant",
              createdAt: new Date(),
              isDeleted: false,
              threadId: this.chatThreadId,
              type: "CHAT_MESSAGE",
              userId: "",
              multiModalImage: "",
            };

            this.addToMessages(mappedContent);
            this.lastMessage = mappedContent.content;
            break;
          case "abort":
            // Mark progress messages as failed
            this.messages.forEach((msg) => {
              if (msg.isProgressMessage) {
                msg.progressFailed = true;
                msg.content = msg.content.replace("✓", "✗");
              }
            });
            this.removeMessage(newUserMessage.id);
            this.loading = "idle";
            break;
          case "error":
            // Mark progress messages as failed
            this.messages.forEach((msg) => {
              if (msg.isProgressMessage) {
                msg.progressFailed = true;
                msg.content = msg.content.replace("✓", "✗");
              }
            });
            showError(responseType.response);
            this.loading = "idle";
            break;
          case "finalContent":
            // Remove any remaining progress messages on completion
            this.messages = this.messages.filter(
              (msg) => !msg.isProgressMessage
            );
            this.loading = "idle";
            this.completed(this.lastMessage);
            this.updateTitle();
            break;
          default:
            break;
        }
      }
    });
  }
}

export const chatStore = proxy(new ChatState());

export const useChat = () => {
  return useSnapshot(chatStore, { sync: true });
};

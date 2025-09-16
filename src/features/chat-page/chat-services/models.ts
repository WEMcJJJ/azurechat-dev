import { ChatCompletionSnapshot } from "openai/lib/ChatCompletionStream";
import { ChatCompletionMessage } from "openai/resources/chat/completions";

export const CHAT_DOCUMENT_ATTRIBUTE = "CHAT_DOCUMENT";
export const CHAT_THREAD_ATTRIBUTE = "CHAT_THREAD";
export const MESSAGE_ATTRIBUTE = "CHAT_MESSAGE";
export const CHAT_CITATION_ATTRIBUTE = "CHAT_CITATION";

export interface ChatMessageModel {
  id: string;
  createdAt: Date;
  isDeleted: boolean;
  threadId: string;
  userId: string;
  content: string;
  role: ChatRole;
  name: string;
  multiModalImage?: string;
  modelId?: string; // Store which model generated this message
  modelName?: string; // Store the friendly name of the model that generated this message
  type: typeof MESSAGE_ATTRIBUTE;
  // Optional structured metadata for blocked image events
  blockedMeta?: {
    source?: string;
    blockedCategories?: string[];
    riskScore?: number;
    suggestions?: string[];
  };
}

export type ChatRole = "system" | "user" | "assistant" | "function" | "tool";

export interface ChatThreadModel {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
  userId: string;
  useName: string;
  isDeleted: boolean;
  bookmarked: boolean;
  personaMessage: string;
  personaMessageTitle: string;
  extension: string[];
  modelId?: string; // ID of the Azure OpenAI model to use for this thread
  imageModelId?: string; // ID of the image generation model to use for this thread (dall-e-3, gpt-image-1)
  type: typeof CHAT_THREAD_ATTRIBUTE;
}

export interface UserPrompt {
  id: string; // thread id
  message: string;
  multimodalImage: string;
}

export interface ChatDocumentModel {
  id: string;
  name: string;
  chatThreadId: string;
  userId: string;
  isDeleted: boolean;
  createdAt: Date;
  type: typeof CHAT_DOCUMENT_ATTRIBUTE;
}

export interface ToolsInterface {
  name: string;
  description: string;
  parameters: any;
}

export type MenuItemsGroupName = "Bookmarked" | "Past 7 days" | "Previous";

export type MenuItemsGroup = {
  groupName: MenuItemsGroupName;
} & ChatThreadModel;

export type ChatCitationModel = {
  id: string;
  content: any;
  userId: string;
  type: typeof CHAT_CITATION_ATTRIBUTE;
};

export type AzureChatCompletionFunctionCall = {
  type: "functionCall";
  response: ChatCompletionMessage.FunctionCall;
};

export type AzureChatCompletionFunctionCallResult = {
  type: "functionCallResult";
  response: string;
};

export type AzureChatCompletionContent = {
  type: "content";
  response: ChatCompletionSnapshot;
};

export type AzureChatCompletionFinalContent = {
  type: "finalContent";
  response: string;
};

// Unified image block event for consistent UX
export interface AzureChatCompletionImageBlockedPayload {
  source: 'api_content_filter' | 'model_refusal' | 'pre_validation';
  message: string; // human readable guidance (may be markdown)
  originalPrompt?: string;
  requestId?: string;
  blockedCategories?: string[]; // e.g. ['violence:high']
  tokenSummary?: Record<string, { count: number; samples: string[] }>;
  suggestions?: string[];
  guidanceVersion: string;
  schemaVersion?: number;
  riskScore?: number; // aggregated lexical risk heuristic 0-1
  riskBreakdown?: Record<string, number>; // per category normalized weights
}

export type AzureChatCompletionImageBlocked = {
  type: 'imageBlocked';
  response: AzureChatCompletionImageBlockedPayload;
};

export type AzureChatCompletionError = {
  type: "error";
  response: string;
};

export type AzureChatCompletionAbort = {
  type: "abort";
  response: string;
};

export type AzureChatCompletion =
  | AzureChatCompletionError
  | AzureChatCompletionFunctionCall
  | AzureChatCompletionFunctionCallResult
  | AzureChatCompletionContent
  | AzureChatCompletionFinalContent
  | AzureChatCompletionImageBlocked
  | AzureChatCompletionAbort;

// https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/read?view=doc-intel-4.0.0&tabs=sample-code#input-requirements-v4
export enum SupportedFileExtensionsDocumentIntellicence {
  JPEG = "JPEG",
  JPG = "JPG",
  PNG = "PNG",
  BMP = "BMP",
  TIFF = "TIFF",
  HEIF = "HEIF",
  DOCX = "DOCX",
  XLSX = "XLSX",
  PPTX = "PPTX",
  HTML = "HTML",
  PDF = "PDF",
}

// https://platform.openai.com/docs/guides/images?api-mode=responses#image-input-requirements
export enum SupportedFileExtensionsInputImages{
  JPEG = "JPEG",
  JPG = "JPG",
  PNG = "PNG",
  WEBP = "WEBP"
}

export enum SupportedFileExtensionsTextFiles {
  TXT = "TXT",
  LOG = "LOG",
  CSV = "CSV",
  MD = "MD",
  RTF = "RTF",
  HTML = "HTML",
  HTM = "HTM",
  CSS = "CSS",
  JS = "JS",
  JSON = "JSON",
  XML = "XML",
  YML = "YML",
  YAML = "YAML",
  PHP = "PHP",
  PY = "PY",
  JAVA = "JAVA",
  C = "C",
  H = "H",
  CPP = "CPP",
  HPP = "HPP",
  TS = "TS",
  SQL = "SQL",
  INI = "INI",
  CONF = "CONF",
  ENV = "ENV",
  TEX = "TEX",
  SH = "SH",
  BAT = "BAT",
  PS1 = "PS1",
  GITIGNORE = "GITIGNORE",
  GRADLE = "GRADLE",
  GROOVY = "GROOVY",
  MAKEFILE = "MAKEFILE",
  MK = "MK",
  PLIST = "PLIST",
  TOML = "TOML",
  RC = "RC",
}


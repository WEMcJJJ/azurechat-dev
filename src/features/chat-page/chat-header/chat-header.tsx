import { ExtensionModel } from "@/features/extensions-page/extension-services/models";
import { CHAT_DEFAULT_PERSONA } from "@/features/theme/theme-config";
import { VenetianMask, FileText, Lightbulb } from "lucide-react";
import { FC } from "react";
import { ChatDocumentModel, ChatThreadModel } from "../chat-services/models";
import { ModelSelect } from "../chat-components/ModelSelect";
import { DocumentDetail } from "./document-detail";
import { ExtensionDetail } from "./extension-detail";
import { PersonaDetail } from "./persona-detail";

interface Props {
  chatThread: ChatThreadModel;
  chatDocuments: Array<ChatDocumentModel>;
  extensions: Array<ExtensionModel>;
  onModelChange?: (modelId: string) => void;
}

export const ChatHeader: FC<Props> = (props) => {
  const persona =
    props.chatThread.personaMessageTitle === "" ||
    props.chatThread.personaMessageTitle === undefined
      ? CHAT_DEFAULT_PERSONA
      : props.chatThread.personaMessageTitle;

  const hasDocuments = props.chatDocuments.length > 0;
  const chatMode = hasDocuments ? "Hybrid Mode" : "Standard Mode";
  const chatModeDescription = hasDocuments 
    ? "Using uploaded documents + general knowledge" 
    : "Using general knowledge";
  
  return (
    <div className="bg-background border-b flex items-center py-2">
      <div className="container max-w-5xl flex justify-between items-center">
        <div className="flex flex-col">
          <span className="max-w-96 break-words">{props.chatThread.name}</span>
          <div className="flex gap-4">
            <span className="text-sm text-muted-foreground flex gap-1 items-center">
              <VenetianMask size={18} />
              {persona}
            </span>
            <span className="text-sm text-muted-foreground flex gap-1 items-center" title={chatModeDescription}>
              {hasDocuments ? <FileText size={18} /> : <Lightbulb size={18} />}
              {chatMode}
            </span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <ModelSelect 
            selectedModelId={props.chatThread.modelId}
            onModelChange={props.onModelChange || (() => {})}
            disabled={!props.onModelChange}
          />
          <PersonaDetail chatThread={props.chatThread} />
          <DocumentDetail chatDocuments={props.chatDocuments} />
          <ExtensionDetail
            disabled={props.chatDocuments.length !== 0}
            extensions={props.extensions}
            installedExtensionIds={props.chatThread.extension}
            chatThreadId={props.chatThread.id}
            parent={"chat"}
          />
        </div>
      </div>
    </div>
  );
};

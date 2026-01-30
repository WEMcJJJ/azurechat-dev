import { Markdown } from "@/features/ui/markdown/markdown";
import { FunctionSquare } from "lucide-react";
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { RecursiveUI } from "../ui/recursive-ui";
import { CitationAction } from "./citation/citation-action";
import { ImageLightbox } from "@/features/ui/markdown/image-lightbox";

interface MessageContentProps {
  message: {
    role: string;
    content: string;
    name: string;
    multiModalImage?: string;
    hiddenToolResult?: boolean;
    isProgressMessage?: boolean;
    progressFailed?: boolean;
  };
  isAdmin?: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ message, isAdmin = false }) => {
  // Render progress messages (ephemeral notifications)
  if (message.role === "system" && message.isProgressMessage) {
    const isFailed = message.progressFailed === true;
    return (
      <div className={`text-sm py-1 px-2 rounded ${
        isFailed ? "text-red-600" : "text-muted-foreground"
      }`}>
        {message.content}
      </div>
    );
  }
  
  if (message.role === "assistant" || message.role === "user") {
    return (
      <>
        <Markdown
          content={message.content}
          onCitationClick={CitationAction}
        ></Markdown>
        {message.multiModalImage && (
          <ImageLightbox 
            src={message.multiModalImage} 
            alt="Uploaded image"
            showCopyButton={!message.multiModalImage.startsWith('data:image/')}
          />
        )}
      </>
    );
  }

  if (message.role === "tool" || message.role === "function") {
    const isHiddenToolResult = message.hiddenToolResult === true;
    const parsedContent = toJson(message.content);
    const isImageResult = typeof parsedContent === "object" && parsedContent?.type === "image";
    
    console.log('Tool message rendering:', {
      name: message.name,
      isImageResult,
      parsedContent: isImageResult ? 'ImageToolResult' : parsedContent,
      hiddenToolResult: message.hiddenToolResult
    });
    
    // Render image results inline in chat, not in accordion
    if (isImageResult) {
      console.log('Rendering image inline with URLs:', parsedContent.urls);
      return (
        <div className="py-3">
          <RecursiveUI documentField={parsedContent} />
        </div>
      );
    }
    
    // Non-image tool results display in accordion
    const accordionTitle = isHiddenToolResult && isAdmin
      ? `🔍 Debug: ${message.name} ${message.name === "tool" ? "output" : "function"} (hidden from users)`
      : `Show ${message.name} ${message.name === "tool" ? "output" : "function"}`;
    
    return (
      <div className="py-3">
        <Accordion
          type="multiple"
          className={`bg-background rounded-md border p-2 ${isHiddenToolResult && isAdmin ? 'border-orange-400' : ''}`}
        >
          <AccordionItem value="item-1" className="">
            <AccordionTrigger className="text-sm py-1 items-center gap-2">
              <div className="flex gap-2 items-center">
                <FunctionSquare
                  size={18}
                  strokeWidth={1.4}
                  className={isHiddenToolResult && isAdmin ? "text-orange-400" : "text-muted-foreground"}
                />{" "}
                {accordionTitle}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <RecursiveUI documentField={parsedContent} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  return null;
};

const toJson = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

export default MessageContent;

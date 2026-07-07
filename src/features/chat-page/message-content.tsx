import { Markdown } from "@/features/ui/markdown/markdown";
import { FunctionSquare } from "lucide-react";
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { RecursiveUI, ClickableImageUrl } from "../ui/recursive-ui";
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

  // Handle function call messages (role: "function") - these show the ARGUMENTS
  if (message.role === "function") {
    const parsedArgs = parseJsonSafe(message.content);
    const isImageFunction = message.name === "create_img" || message.name === "edit_img";
    
    // Title format: "Show {function_name} function" (matches DALL-E 3)
    const accordionTitle = `Show ${message.name} function`;
    
    return (
      <div className="py-3">
        <Accordion type="multiple" className="bg-background rounded-md border p-2">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-sm py-1 items-center gap-2">
              <div className="flex gap-2 items-center">
                <FunctionSquare size={18} strokeWidth={1.4} className="text-muted-foreground" />
                {accordionTitle}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {isImageFunction && typeof parsedArgs === "object" && parsedArgs !== null ? (
                <div className="space-y-1 text-sm text-foreground">
                  {parsedArgs.prompt && (
                    <div><span className="text-muted-foreground">prompt:</span> {parsedArgs.prompt}</div>
                  )}
                  {parsedArgs.n && parsedArgs.n > 1 && (
                    <div><span className="text-muted-foreground">count:</span> {parsedArgs.n}</div>
                  )}
                  {parsedArgs.size && (
                    <div><span className="text-muted-foreground">size:</span> {parsedArgs.size}</div>
                  )}
                  {parsedArgs.quality && (
                    <div><span className="text-muted-foreground">quality:</span> {parsedArgs.quality}</div>
                  )}
                  {parsedArgs.imageUrl && (
                    <div>
                      <span className="text-muted-foreground">source:</span>{" "}
                      <ClickableImageUrl url={parsedArgs.imageUrl} />
                    </div>
                  )}
                </div>
              ) : (
                <RecursiveUI documentField={parsedArgs} />
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    );
  }

  // Handle tool result messages (role: "tool") - these show the RESULTS
  if (message.role === "tool") {
    const parsedContent = parseJsonSafe(message.content);
    
    // Tool results always display in accordion
    // Title format: "Show tool output" (matches DALL-E 3)
    const isHiddenToolResult = message.hiddenToolResult === true;
    const accordionTitle = isHiddenToolResult && isAdmin
      ? `🔍 Debug: tool output (hidden from users)`
      : `Show tool output`;
    
    return (
      <div className="py-3">
        <Accordion
          type="multiple"
          className={`bg-background rounded-md border p-2 ${isHiddenToolResult && isAdmin ? 'border-orange-400' : ''}`}
        >
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-sm py-1 items-center gap-2">
              <div className="flex gap-2 items-center">
                <FunctionSquare
                  size={18}
                  strokeWidth={1.4}
                  className={isHiddenToolResult && isAdmin ? "text-orange-400" : "text-muted-foreground"}
                />
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

/**
 * Safely parse JSON, handling potential double-stringification
 * Returns the parsed object or the original value if parsing fails
 */
const parseJsonSafe = (value: string): any => {
  if (typeof value !== "string") {
    return value;
  }
  
  try {
    let parsed = JSON.parse(value);
    
    // Handle potential double-stringification
    // If the result is still a string that looks like JSON, try parsing again
    if (typeof parsed === "string" && (parsed.startsWith("{") || parsed.startsWith("["))) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // Second parse failed, use first parse result
      }
    }
    
    return parsed;
  } catch (e) {
    return value;
  }
};

export default MessageContent;

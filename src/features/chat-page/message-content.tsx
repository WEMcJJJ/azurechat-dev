import React from "react";
import { Markdown } from "@/features/ui/markdown/markdown";
import { FunctionSquare } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { RecursiveUI } from "../ui/recursive-ui";
import { CitationAction } from "./citation/citation-action";
import { ImageBlockedCard } from "../ui/chat/image-blocked-card";

interface MessageContentProps {
  message: {
    role: string;
    content: string;
    name: string;
    multiModalImage?: string;
  };
}

const BLOCK_HEADER = "🚫 **Image blocked"; // prefix we add on server side

function extractCategories(markdown: string): string[] | undefined {
  const m = markdown.match(/Blocked Categories:\**\s*([^\n]+)/i);
  if (m) {
    return m[1].split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
  }
  return undefined;
}

const MessageContent: React.FC<MessageContentProps> = ({ message }) => {
  const isBlocked = message.role === 'assistant' && ((message as any).blockedMeta || message.content.startsWith(BLOCK_HEADER));
  if (isBlocked) {
    const meta: any = (message as any).blockedMeta || {};
    return (
      <ImageBlockedCard
        markdown={message.content}
        source={meta.source || (/pre-validation/i.test(message.content) ? 'pre-validation' : 'content-filter')}
        blockedCategories={meta.blockedCategories || extractCategories(message.content)}
      />
    );
  }
  if (message.role === "assistant" || message.role === "user") {
    return (
      <>
        <Markdown content={message.content} onCitationClick={CitationAction} />
        {message.multiModalImage && (
          <a
            href={message.multiModalImage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 group"
            title="Open full-size image in new tab"
          >
            <img
              src={message.multiModalImage}
              alt="Chat image"
              className="max-h-64 rounded border border-border transition group-hover:shadow-lg cursor-pointer"
            />
          </a>
        )}
      </>
    );
  }

  if (message.role === "tool" || message.role === "function") {
    return (
      <div className="py-3">
        <Accordion
          type="multiple"
          className="bg-background rounded-md border p-2"
        >
          <AccordionItem value="item-1" className="">
            <AccordionTrigger className="text-sm py-1 items-center gap-2">
              <div className="flex gap-2 items-center">
                <FunctionSquare
                  size={18}
                  strokeWidth={1.4}
                  className="text-muted-foreground"
                />{" "}
                Show {message.name}{" "}
                {message.name === "tool" ? "output" : "function"}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <RecursiveUI documentField={toJson(message.content)} />
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

"use client";
import React, { FC, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";

interface Prop {
  documentField: any;
}

/**
 * Safely parse JSON, handling potential double-stringification
 */
const parseJsonSafe = (value: any): any => {
  if (typeof value !== "string") {
    return value;
  }
  
  try {
    let parsed = JSON.parse(value);
    
    // Handle potential double-stringification
    if (typeof parsed === "string" && (parsed.startsWith("{") || parsed.startsWith("["))) {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // Second parse failed, use first parse result
      }
    }
    
    return parsed;
  } catch {
    return value;
  }
};

export const RecursiveUI: FC<Prop> = (props) => {
  const { documentField } = props;
  
  // First, try to parse if it's a JSON string
  const parsedField = parseJsonSafe(documentField);

  // Handle primitive types
  if (
    typeof parsedField === "string" ||
    typeof parsedField === "number" ||
    typeof parsedField === "boolean" ||
    typeof parsedField === "bigint" ||
    typeof parsedField === "symbol" ||
    typeof parsedField === "undefined" ||
    typeof parsedField === "function" ||
    parsedField === null
  ) {
    return (
      <div className="border border-foreground/5 rounded p-3 overflow-x-auto gap-3 flex flex-col text-sm">
        <div className="flex gap-1 flex-col">{String(parsedField)}</div>
      </div>
    );
  }

  // Handle objects/arrays recursively
  return (
    <div className="border border-foreground/5 rounded p-3 overflow-x-auto gap-3 flex flex-col text-sm">
      {Object.entries(parsedField).map(([key, value], index) => {
        if (typeof value === "object" && value !== null) {
          return (
            <div key={index} className="flex gap-1 flex-col">
              <span className="text-muted-foreground">{key}</span>{" "}
              <RecursiveUI documentField={value} />
            </div>
          );
        } else {
          // Check if value is an image URL
          const isImageUrl = typeof value === "string" && 
                             (value.includes("/api/images") || value.startsWith("./api/images"));
          
          return (
            <div key={index} className="">
              <span className="text-muted-foreground">{key}:</span>{" "}
              {isImageUrl ? (
                <ClickableImageUrl url={value as string} />
              ) : (
                <>{String(value)}{" "}</>
              )}
            </div>
          );
        }
      })}
    </div>
  );
};

// Clickable URL that opens image in lightbox - exported for use in other components
export const ClickableImageUrl: FC<{ url: string }> = ({ url }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Normalize URL (strip leading ./ if present)
  const normalizedUrl = url.startsWith('./') ? url.substring(1) : url;
  
  // Construct full URL for display (with hostname)
  const fullUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${normalizedUrl}`
    : normalizedUrl;
  
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-blue-500 hover:text-blue-700 underline break-all text-left font-mono text-xs"
        title="Click to preview image"
      >
        {fullUrl}
      </button>
      
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 max-h-[90vh] max-w-[90vw] translate-x-[-50%] translate-y-[-50%]">
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>Image Preview</DialogPrimitive.Title>
            </VisuallyHidden.Root>
            <div className="relative">
              <img
                src={normalizedUrl}
                alt="Preview"
                className="max-h-[90vh] max-w-[90vw] rounded-lg"
              />
              <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm bg-background/80 p-2 opacity-70 ring-offset-background transition-opacity hover:opacity-100">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

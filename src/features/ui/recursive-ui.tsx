"use client";
import React, { FC, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";
import Image from "next/image";
import { ImageLightbox } from "@/features/ui/markdown/image-lightbox";
import { isImageToolResult } from "@/types/image-generation";

interface Prop {
  documentField: any;
}

export const RecursiveUI: FC<Prop> = (props) => {
  const { documentField } = props;
  let node: React.ReactNode = null;

  // Check if this is an ImageToolResult structure
  if (isImageToolResult(documentField)) {
    const { urls, titles, context } = documentField;
    return (
      <div className="flex flex-col gap-4">
        {urls.map((url, index) => (
          <div key={index} className="flex flex-col gap-2">
            {titles && titles[index] && (
              <div className="font-semibold text-sm">{titles[index]}</div>
            )}
            <ImageLightbox 
              src={url} 
              alt={titles?.[index] || context.prompt || "Generated image"}
              showCopyButton={true}
            />
          </div>
        ))}
      </div>
    );
  }

  if (
    typeof documentField === "string" ||
    typeof documentField === "number" ||
    typeof documentField === "boolean" ||
    typeof documentField === "bigint" ||
    typeof documentField === "symbol" ||
    typeof documentField === "undefined" ||
    typeof documentField === "function"
  ) {
    node = <div className="flex gap-1 flex-col">{documentField}</div>;
  }

  return (
    <div className="border border-foreground/5 rounded p-3 overflow-x-auto gap-3 flex flex-col text-sm">
      {node
        ? node
        : Object.entries(props.documentField).map(([key, value], index) => {
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
                    <>{value as React.ReactNode}{" "}</>
                  )}
                </div>
              );
            }
          })}
    </div>
  );
};

// Clickable URL that opens image in lightbox
const ClickableImageUrl: FC<{ url: string }> = ({ url }) => {
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

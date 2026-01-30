"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Download, X, ClipboardIcon, CheckIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "../button";
import { cn } from "@/ui/lib";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  className?: string;
  showCopyButton?: boolean;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  src,
  alt = "Generated image",
  className = "",
  showCopyButton = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Normalize URLs to absolute URLs for backwards compatibility
  // Strip any sandbox: prefix and handle relative URLs
  let cleanSrc = src;
  
  // Remove sandbox: prefix if present
  if (cleanSrc.startsWith("sandbox:")) {
    cleanSrc = cleanSrc.substring(8); // Remove "sandbox:"
  }
  
  // Replace localhost URLs with current domain (for legacy local dev images)
  // Handles both http://localhost and https://localhost
  if (cleanSrc.includes("://localhost:")) {
    try {
      const url = new URL(cleanSrc);
      // Extract just the pathname and search (e.g., /api/images?t=...&img=...)
      cleanSrc = url.pathname + url.search;
      console.log(`🔄 Normalized localhost URL to: ${cleanSrc}`);
    } catch (error) {
      console.error("Error parsing localhost URL:", error);
      // Fallback to regex extraction
      const urlMatch = cleanSrc.match(/\/api\/images\?.*/);
      if (urlMatch) {
        cleanSrc = urlMatch[0];
      }
    }
  }
  
  // Convert relative URLs to absolute
  const normalizedSrc = cleanSrc.startsWith("/api/images") 
    ? `${window.location.origin}${cleanSrc}`
    : cleanSrc;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(normalizedSrc);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(normalizedSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  return (
    <>
      {/* Thumbnail with hover copy button */}
      <div 
        className="relative inline-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={normalizedSrc}
          alt={alt}
          className={`cursor-pointer rounded-md hover:opacity-90 transition-opacity ${className}`}
          onClick={() => setIsOpen(true)}
          style={{ maxWidth: "100%", height: "auto" }}
        />
        
        {/* Copy URL button overlay */}
        {isHovered && showCopyButton && (
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-2 right-2 bg-background/90 hover:bg-background"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyUrl();
            }}
          >
            {isCopied ? (
              <CheckIcon size={16} />
            ) : (
              <ClipboardIcon size={16} />
            )}
            <span className="ml-1 text-xs">Copy URL</span>
          </Button>
        )}
      </div>

      {/* Lightbox Dialog with semi-transparent overlay */}
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Portal>
          {/* Custom semi-transparent overlay */}
          <DialogPrimitive.Overlay
            className={cn(
              "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            )}
          />
          {/* Dialog content */}
          <DialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
              "max-w-[95vw] max-h-[95vh] w-full h-full",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            )}
          >
            {/* Accessible title for screen readers */}
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>
                {alt || "Image viewer"}
              </DialogPrimitive.Title>
            </VisuallyHidden.Root>

            <div className="relative w-full h-full flex flex-col">
              {/* Header with close and download buttons */}
              <div className="absolute top-0 right-0 z-10 flex gap-2 p-4">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleDownload}
                  className="bg-background/90 hover:bg-background"
                  aria-label="Download image"
                >
                  <Download size={20} />
                </Button>
                <DialogPrimitive.Close asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="bg-background/90 hover:bg-background"
                    aria-label="Close lightbox"
                  >
                    <X size={20} />
                  </Button>
                </DialogPrimitive.Close>
              </div>

              {/* Image container */}
              <div className="relative flex-1 flex items-center justify-center p-8">
                <img
                  src={normalizedSrc}
                  alt={alt}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  style={{ maxHeight: "calc(95vh - 4rem)" }}
                />
              </div>

              {/* Lightbox footer with alt text and copy URL button */}
              {alt && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/30 backdrop-blur-sm">
                  <div className="flex items-center justify-between text-sm text-white gap-2">
                    <p className="font-medium">{alt}</p>
                    {showCopyButton && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleCopyUrl}
                        className="flex-shrink-0 bg-background/90 hover:bg-background"
                      >
                        {isCopied ? (
                          <CheckIcon size={16} />
                        ) : (
                          <ClipboardIcon size={16} />
                        )}
                        <span className="ml-1 text-xs">Copy URL</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};

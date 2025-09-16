"use client";

// Redesigned component: always-inline segmented control (if >1 model) so it blends
// with other input actions. No functionality change – still relies on ImageModelSelector
// for state & persistence. We simply present it differently and remove the old
// two‑step toggle reveal that duplicated the image upload icon.

import { useImageModel } from "@/features/image/context/image-model-context";
import { cn } from "@/features/ui/lib"; // shared Tailwind merge helper
import { useState, useRef, useEffect } from "react";
import { Sparkles } from "lucide-react";

interface ImageGenerationOptionsProps {
  disabled?: boolean;
  className?: string;
}

// Fallback minimal cn implementation if project has no helper (tree-shaken if unused)
function cx(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export const ImageGenerationOptions: React.FC<ImageGenerationOptionsProps> = ({
  disabled = false,
  className = ""
}) => {
  const { selectedImageModel, setSelectedImageModel, availableImageModels, loading, error } = useImageModel();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (open && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  if (loading) {
    return <div className={cx("h-9 px-3 flex items-center rounded-md border bg-muted/40 text-xs text-muted-foreground animate-pulse", className)}>Img Model</div>;
  }
  if (error || availableImageModels.length === 0) return null;

  const labelForId = (id: string) => id === 'dall-e-3' ? 'DALL-E 3' : (id === 'gpt-image-1' ? 'GPT-image-1' : id);
  const currentLabel = labelForId(selectedImageModel);

  return (
    <div ref={dropdownRef} className={cx("relative flex items-center gap-1", className)}>
      <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cx(
          "h-9 px-3 text-xs font-medium rounded-md border bg-muted/40 hover:bg-muted/60 transition-colors min-w-[110px] text-center",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select image generation model"
      >
        {currentLabel}
      </button>
  {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 min-w-[140px] rounded-md border bg-popover shadow-md p-1 flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-1"
        >
          {availableImageModels.map(m => (
            <button
              key={m.id}
              role="option"
              aria-selected={m.id === selectedImageModel}
              onClick={() => {
                setSelectedImageModel(m.id);
                setOpen(false);
              }}
              className={cx(
                "text-left text-xs px-2 py-1 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                m.id === selectedImageModel && "bg-accent text-accent-foreground"
              )}
            >
              {labelForId(m.id)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

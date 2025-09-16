'use client';

import { Brain, Palette } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { useImageModel } from '@/features/image/context/image-model-context';

interface ImageModelSelectorProps {
  className?: string;
  disabled?: boolean;
}

export const ImageModelSelector: React.FC<ImageModelSelectorProps> = ({
  className = '',
  disabled = false,
}) => {
  const { selectedImageModel, setSelectedImageModel, availableImageModels, loading, error } = useImageModel();
  
  // Debug logging
  console.log('🎛️ ImageModelSelector render:', {
    selectedImageModel,
    availableImageModels: availableImageModels.map(m => m.id),
    loading,
    error
  });

  if (loading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Button size="icon" variant="ghost" disabled type="button" aria-label="Loading image models">
          <Brain size={16} className="animate-pulse" />
        </Button>
      </div>
    );
  }

  if (error || availableImageModels.length === 0) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Button size="icon" variant="ghost" disabled type="button" aria-label="Image models unavailable">
          <Brain size={16} className="text-gray-400" />
        </Button>
      </div>
    );
  }

  if (availableImageModels.length === 1) {
    // If only one model is available, show it as a static display
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Button size="icon" variant="default" disabled type="button" aria-label={`Image model: ${availableImageModels[0].name}`}>
          {availableImageModels[0].id === 'dall-e-3' ? <Palette size={16} /> : <Brain size={16} />}
        </Button>
      </div>
    );
  }

  // Create a toggle interface - show current model as selected, other as ghost
  const dalleModel = availableImageModels.find(m => m.id === 'dall-e-3');
  const gptImageModel = availableImageModels.find(m => m.id === 'gpt-image-1');

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* DALL-E 3 Button */}
      {dalleModel && (
        <Button
          key="dall-e-3"
          size="icon"
          variant={selectedImageModel === 'dall-e-3' ? "default" : "ghost"}
          onClick={() => {
            console.log(`🖱️ DALL-E 3 button clicked`);
            setSelectedImageModel('dall-e-3');
          }}
          disabled={disabled}
          type="button"
          aria-label="Select DALL-E 3 for image generation"
          title="DALL-E 3: Advanced image generation with detailed prompts"
        >
          <Palette size={16} />
        </Button>
      )}
      
      {/* GPT-image-1 Button */}
      {gptImageModel && (
        <Button
          key="gpt-image-1"
          size="icon"
          variant={selectedImageModel === 'gpt-image-1' ? "default" : "ghost"}
          onClick={() => {
            console.log(`🖱️ GPT-image-1 button clicked`);
            setSelectedImageModel('gpt-image-1');
          }}
          disabled={disabled}
          type="button"
          aria-label="Select GPT-image-1 for image generation"
          title="GPT-image-1: Latest OpenAI image generation model"
        >
          <Brain size={16} />
        </Button>
      )}
    </div>
  );
};

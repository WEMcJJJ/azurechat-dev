'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ImageModel } from '@/features/common/config/image-config';

interface ImageModelContextValue {
  selectedImageModel: string;
  setSelectedImageModel: (modelId: string) => void;
  availableImageModels: ImageModel[];
  loading: boolean;
  error: string | null;
}

const ImageModelContext = createContext<ImageModelContextValue | null>(null);

interface ImageModelProviderProps {
  children: React.ReactNode;
  chatThreadId?: string;
  initialImageModel?: string;
  onImageModelUpdate?: (imageModelId: string) => void;
}

export const ImageModelProvider: React.FC<ImageModelProviderProps> = ({ 
  children, 
  chatThreadId,
  initialImageModel,
  onImageModelUpdate
}) => {
  console.log('🏭 ImageModelProvider initialized:', { chatThreadId, initialImageModel });
  
  // Default changed to 'gpt-image-1' per UI requirement when not explicitly provided
  const [selectedImageModel, setSelectedImageModelState] = useState<string>(initialImageModel || 'gpt-image-1');
  const [availableImageModels, setAvailableImageModels] = useState<ImageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setSelectedImageModel = async (modelId: string) => {
    console.log(`🔄 Image Model Selection: ${modelId}`);
    console.log(`  - chatThreadId: ${chatThreadId}`);
    console.log(`  - Current selected model: ${selectedImageModel}`);
    
    // Update local state immediately for UI responsiveness
    setSelectedImageModelState(modelId);
    
    // Persist to database if we have a chat thread ID
    if (chatThreadId) {
      try {
        console.log(`  - Making API call to: /api/chat/${chatThreadId}/image-model`);
        const requestBody = {
          chatThreadId,
          imageModelId: modelId,
        };
        console.log(`  - Request body:`, requestBody);
        
        const response = await fetch(`/api/chat/${chatThreadId}/image-model`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`  - Response status: ${response.status}`);
        const result = await response.json();
        console.log(`  - API response:`, result);
        
        if (response.ok && result.success) {
          console.log(`✅ Successfully updated chat thread image model to: ${modelId}`);
          console.log(`  - Updated chat thread:`, result.chatThread);
          // Notify parent component to update chat thread state
          if (onImageModelUpdate) {
            console.log(`  - Calling onImageModelUpdate callback`);
            onImageModelUpdate(modelId);
          }
        } else {
          console.error('❌ Failed to update chat thread image model:', result.error);
          console.log('  - Reverting local state');
          // Revert the local state on error
          setSelectedImageModelState(selectedImageModel);
        }
      } catch (error) {
        console.error('❌ Error updating chat thread image model:', error);
        console.log('  - Reverting local state due to exception');
        setSelectedImageModelState(selectedImageModel);
      }
    } else {
      console.warn('⚠️ No chatThreadId provided, selection not persisted');
    }
  };

  useEffect(() => {
    const fetchImageModels = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/image/models');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const models = await response.json();
        setAvailableImageModels(models);
        
        // Only set default model if no initial model was provided and none is currently selected
        if (!initialImageModel && !selectedImageModel && models.length > 0) {
          // Prefer gpt-image-1 if available, otherwise first model
          const preferred = models.find((m: any) => m.id === 'gpt-image-1')?.id || models[0].id;
          setSelectedImageModelState(preferred);
        }
      } catch (err) {
        console.error('Failed to fetch image models:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch image models');
      } finally {
        setLoading(false);
      }
    };

    fetchImageModels();
  }, []); // Remove selectedImageModel dependency to prevent infinite re-fetching

  // Update selected model when initialImageModel changes
  useEffect(() => {
    if (initialImageModel && initialImageModel !== selectedImageModel) {
      setSelectedImageModelState(initialImageModel);
    }
  }, [initialImageModel, selectedImageModel]);

  const contextValue: ImageModelContextValue = {
    selectedImageModel,
    setSelectedImageModel,
    availableImageModels,
    loading,
    error,
  };

  return (
    <ImageModelContext.Provider value={contextValue}>
      {children}
    </ImageModelContext.Provider>
  );
};

export const useImageModel = (): ImageModelContextValue => {
  const context = useContext(ImageModelContext);
  if (!context) {
    throw new Error('useImageModel must be used within an ImageModelProvider');
  }
  return context;
};

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/features/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/features/ui/select";
import { Badge } from "@/features/ui/badge";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/features/ui/alert";
import { PublicModel } from "@/types/models";

interface ModelSelectProps {
  selectedModelId?: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelect({ 
  selectedModelId, 
  onModelChange, 
  disabled = false,
  className = "" 
}: ModelSelectProps) {
  const [models, setModels] = useState<PublicModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/models', {
        cache: 'force-cache' // Use browser cache
      });
      
        if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `Failed to load models: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
            if (errorData.details && Array.isArray(errorData.details)) {
              errorMessage += ': ' + errorData.details.map((e: any) => e.message).join(', ');
            }
          }
        } catch {
          // If we can't parse error response, use default message
        }
        throw new Error(errorMessage);
      }      const modelsData = await response.json();
      
      // Ensure we have an array - handle both direct array and wrapped response
      let modelsArray: PublicModel[] = [];
      if (Array.isArray(modelsData)) {
        modelsArray = modelsData;
      } else if (modelsData && typeof modelsData === 'object') {
        // Handle case where response might be wrapped (shouldn't happen with our API but be safe)
        if (Array.isArray(modelsData.response)) {
          modelsArray = modelsData.response;
        } else if (Array.isArray(modelsData.models)) {
          modelsArray = modelsData.models;
        }
      }
      
      setModels(modelsArray);
      
      // If no model is selected and we have models, select the default
      if (!selectedModelId && modelsArray.length > 0) {
        const defaultModel = modelsArray.find(m => m.isDefault) || modelsArray[0];
        // Only auto-select if we have an onModelChange handler
        if (onModelChange) {
          setTimeout(() => onModelChange(defaultModel.id), 0);
        }
      }
    } catch (err) {
      console.error('Failed to load models:', err);
      setError(err instanceof Error ? err.message : 'Failed to load models');
      setModels([]); // Ensure models is always an array
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={loadModels}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Ensure models is an array and check if empty
  const modelsArray = Array.isArray(models) ? models : [];
  if (modelsArray.length === 0 && !loading) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex flex-col gap-2">
          <span>No models configured. Contact your administrator to set up AI models.</span>
          <span className="text-xs text-muted-foreground">
            Run the migration script to import models from environment variables.
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  // Ensure models is an array before using .find()
  const selectedModel = modelsArray.find(m => m.id === selectedModelId);
  
  // If no model is selected but we have models, show helpful text
  const placeholder = modelsArray.length > 0 
    ? "Select a model" 
    : "No models available";

  return (
    <Select
      value={selectedModelId || ""}
      onValueChange={onModelChange}
      disabled={disabled || modelsArray.length === 0}
    >
      <SelectTrigger 
        className={`w-[200px] ${className} ${!selectedModelId && modelsArray.length > 0 ? 'border-orange-500 border-2' : ''}`}
        aria-label="Select AI Model"
      >
        <SelectValue placeholder={placeholder}>
          {selectedModel ? (
            <div className="flex items-center gap-2">
              <span>{selectedModel.friendlyName}</span>
              {selectedModel.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
          ) : (
            <span className={modelsArray.length > 0 && !selectedModelId ? "text-orange-600" : ""}>
              {placeholder}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {modelsArray.map((model) => (
          <SelectItem 
            key={model.id} 
            value={model.id}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span>{model.friendlyName}</span>
              {model.isDefault && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

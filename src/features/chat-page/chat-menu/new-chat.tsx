"use client";

import { Button } from "@/features/ui/button";
import { LoadingIndicator } from "@/features/ui/loading";
import { Plus, AlertCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useState, useEffect } from "react";

export const NewChat = () => {
  const { pending } = useFormStatus();
  const [hasModels, setHasModels] = useState(true); // Optimistically assume models exist
  const [checkingModels, setCheckingModels] = useState(true);

  useEffect(() => {
    checkModelAvailability();
  }, []);

  const checkModelAvailability = async () => {
    try {
      const response = await fetch('/api/models', {
        cache: 'no-cache' // Always check fresh status
      });
      
      if (response.ok) {
        const models = await response.json();
        const modelsArray = Array.isArray(models) ? models : [];
        setHasModels(modelsArray.length > 0);
      } else {
        setHasModels(false);
      }
    } catch (error) {
      console.error('Failed to check model availability:', error);
      setHasModels(false);
    } finally {
      setCheckingModels(false);
    }
  };

  const isDisabled = pending || !hasModels;

  return (
    <Button
      aria-disabled={isDisabled}
      disabled={isDisabled}
      size={"default"}
      className="flex gap-2"
      variant={hasModels ? "outline" : "ghost"}
      title={!hasModels ? "No AI models configured - contact administrator" : "Create a new chat conversation"}
    >
      {checkingModels ? (
        <LoadingIndicator isLoading={true} />
      ) : pending ? (
        <LoadingIndicator isLoading={pending} />
      ) : !hasModels ? (
        <AlertCircle size={18} />
      ) : (
        <Plus size={18} />
      )}
      New Chat
    </Button>
  );
};

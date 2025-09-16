import { ServerActionResponse } from "@/features/common/server-action-response";

export interface ImageGenerationConfig {
  provider: 'dall-e-3' | 'gpt-image-1';
  apiKey: string;
  instanceName?: string;
  deploymentName?: string;
  baseUrl?: string;
  apiVersion: string;
  description?: {
    withFiles?: string;
    noFiles?: string;
    edit?: string;
    promptDescription?: string;
    editPromptDescription?: string;
  };
}

export interface ImageModel {
  id: string;
  name: string;
  description: string;
  provider: 'dall-e-3' | 'gpt-image-1';
}

export const getImageGenerationConfigs = (): Record<string, ImageGenerationConfig> => {
  return {
    'dall-e-3': {
      provider: 'dall-e-3',
      apiKey: process.env.AZURE_OPENAI_DALLE_API_KEY || '',
      instanceName: process.env.AZURE_OPENAI_DALLE_API_INSTANCE_NAME,
      deploymentName: process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME,
      apiVersion: process.env.AZURE_OPENAI_DALLE_API_VERSION || '2023-12-01-preview',
    },
    'gpt-image-1': {
      provider: 'gpt-image-1',
      apiKey: process.env.IMAGE_GEN_OAI_API_KEY || '',
      instanceName: process.env.IMAGE_GEN_OAI_API_INSTANCE_NAME,
      deploymentName: process.env.IMAGE_GEN_OAI_API_DEPLOYMENT_NAME,
      apiVersion: process.env.IMAGE_GEN_OAI_AZURE_API_VERSION || '2025-04-01-preview',
      description: {
        withFiles: process.env.IMAGE_GEN_OAI_DESCRIPTION_WITH_FILES,
        noFiles: process.env.IMAGE_GEN_OAI_DESCRIPTION_NO_FILES,
        edit: process.env.IMAGE_EDIT_OAI_DESCRIPTION,
        promptDescription: process.env.IMAGE_GEN_OAI_PROMPT_DESCRIPTION,
        editPromptDescription: process.env.IMAGE_EDIT_OAI_PROMPT_DESCRIPTION,
      },
    },
  };
};

export const getAvailableImageModels = (): ImageModel[] => {
  const configs = getImageGenerationConfigs();
  const models: ImageModel[] = [];

  if (configs['dall-e-3'].apiKey) {
    models.push({
      id: 'dall-e-3',
      name: 'DALL-E 3',
      description: 'Advanced image generation with detailed prompts',
      provider: 'dall-e-3'
    });
  }

  if (configs['gpt-image-1'].apiKey) {
    models.push({
      id: 'gpt-image-1',
      name: 'GPT-image-1',
      description: 'Latest OpenAI image generation model with enhanced capabilities',
      provider: 'gpt-image-1'
    });
  }

  return models;
};

export const validateImageModelConfig = (modelId: string): ServerActionResponse<ImageGenerationConfig> => {
  const configs = getImageGenerationConfigs();
  const config = configs[modelId];

  if (!config) {
    return {
      status: "ERROR",
      errors: [{ message: `Image generation model ${modelId} is not supported` }]
    };
  }

  if (!config.apiKey) {
    return {
      status: "ERROR",
      errors: [{ message: `Image generation model ${modelId} is not configured (missing API key)` }]
    };
  }

  if (config.provider === 'gpt-image-1' && (!config.instanceName || !config.deploymentName)) {
    return {
      status: "ERROR",
      errors: [{ message: `GPT-image-1 requires instance name and deployment name configuration` }]
    };
  }

  if (config.provider === 'dall-e-3' && (!config.instanceName || !config.deploymentName)) {
    return {
      status: "ERROR",
      errors: [{ message: `DALL-E 3 requires instance name and deployment name configuration` }]
    };
  }

  return {
    status: "OK",
    response: config
  };
};

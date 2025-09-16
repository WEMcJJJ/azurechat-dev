import { OpenAI } from "openai";
import { createAzureOpenAIClient, createAzureOpenAIEmbeddingClient } from "@/server/services/aoaiClientFactory";

/**
 * @deprecated Use createAzureOpenAIClient() instead for model-aware instances
 * Environment variable fallback removed - configure models in database
 */
export const OpenAIInstance = () => {
  throw new Error("OpenAIInstance is deprecated and environment variable fallbacks have been removed. Use getOpenAIInstance() or createAzureOpenAIClient() with proper model configuration instead.");
};

/**
 * Gets an OpenAI client instance for the specified model or default model
 * @param modelId Optional model ID to use, defaults to default model
 */
export const getOpenAIInstance = async (modelId?: string): Promise<OpenAI> => {
  return await createAzureOpenAIClient(modelId);
};

/**
 * @deprecated Use createAzureOpenAIEmbeddingClient() instead for model-aware instances
 * Environment variable fallback removed - configure models in database
 */
export const OpenAIEmbeddingInstance = () => {
  throw new Error("OpenAIEmbeddingInstance is deprecated and environment variable fallbacks have been removed. Use getOpenAIEmbeddingInstance() or createAzureOpenAIEmbeddingClient() with proper model configuration instead.");
};

/**
 * Gets an OpenAI embedding client instance for the specified model or default model
 * @param modelId Optional model ID to use, defaults to default model
 */
export const getOpenAIEmbeddingInstance = async (modelId?: string): Promise<OpenAI> => {
  return await createAzureOpenAIEmbeddingClient(modelId);
};

/**
 * @deprecated Use getOpenAIInstance() with appropriate model instead
 */
export const OpenAIDALLEInstance = () => {
  if (
    !process.env.AZURE_OPENAI_DALLE_API_KEY ||
    !process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME ||
    !process.env.AZURE_OPENAI_DALLE_API_INSTANCE_NAME
  ) {
    throw new Error(
      "Azure OpenAI DALLE endpoint config is not set, check environment variables."
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_DALLE_API_KEY,
    baseURL: `https://${process.env.AZURE_OPENAI_DALLE_API_INSTANCE_NAME}.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_DALLE_API_DEPLOYMENT_NAME}`,
    defaultQuery: {
      "api-version":
        process.env.AZURE_OPENAI_DALLE_API_VERSION || "2024-02-01",
    },
    defaultHeaders: {
      "api-key": process.env.AZURE_OPENAI_DALLE_API_KEY,
    },
  });
  return openai;
};
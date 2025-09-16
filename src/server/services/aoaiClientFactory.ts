"use server";
import "server-only";

import { OpenAI } from "openai";
import { getDefaultModel, getModelById } from "../repositories/modelRepository";
import { decryptSecret } from "./cryptoService";
import { ModelConfig } from "@/types/models";

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  instanceName: string;
}

/**
 * Gets Azure OpenAI configuration for a specific model ID or the default model
 */
export async function getAzureOpenAIConfig(modelId?: string): Promise<AzureOpenAIConfig> {
  try {
    let modelResponse;
    
    if (modelId) {
      modelResponse = await getModelById(modelId);
    } else {
      modelResponse = await getDefaultModel();
    }

    if (modelResponse.status !== "OK") {
      throw new Error(`Failed to get model configuration: ${modelResponse.errors?.[0]?.message || 'Unknown error'}`);
    }

    const model = modelResponse.response;

    if (!model.enabled) {
      throw new Error(`Model ${model.friendlyName} is disabled`);
    }

    // Decrypt the API key
    const apiKey = await decryptSecret(model.apiKeyEnc);
    const endpoint = `https://${model.instanceName}.openai.azure.com/`;

    return {
      endpoint,
      apiKey,
      deploymentName: model.deploymentName,
      apiVersion: model.apiVersion,
      instanceName: model.instanceName
    };
  } catch (error) {
    console.error('Failed to get Azure OpenAI config:', error);
    throw error;
  }
}

/**
 * Creates an OpenAI client instance for a specific model
 */
export async function createAzureOpenAIClient(modelId?: string): Promise<OpenAI> {
  const config = await getAzureOpenAIConfig(modelId);
  
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: `${config.endpoint}openai/deployments/${config.deploymentName}`,
    defaultQuery: { "api-version": config.apiVersion },
    defaultHeaders: { "api-key": config.apiKey },
  });
}

/**
 * Creates an OpenAI client instance for embeddings using dedicated embeddings deployment
 * Note: Embeddings use a separate deployment regardless of the chat model selected
 */
export async function createAzureOpenAIEmbeddingClient(modelId?: string): Promise<OpenAI> {
  // Use dedicated embeddings environment variables instead of chat model config
  const embeddingsApiKey = process.env.AZURE_OPENAI_EMBEDDINGS_KEY;
  const embeddingsInstanceName = process.env.AZURE_OPENAI_EMBEDDINGS_INSTANCE_NAME;
  const embeddingsDeploymentName = process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME;
  const embeddingsApiVersion = process.env.AZURE_OPENAI_API_EMBEDDINGS_VERSION || "2025-04-01-preview";

  if (!embeddingsApiKey || !embeddingsInstanceName || !embeddingsDeploymentName) {
    throw new Error(
      "Azure OpenAI embeddings configuration is missing. Please set AZURE_OPENAI_EMBEDDINGS_KEY, " +
      "AZURE_OPENAI_EMBEDDINGS_INSTANCE_NAME, and AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME in your environment variables."
    );
  }

  const endpoint = `https://${embeddingsInstanceName}.openai.azure.com/`;
  
  return new OpenAI({
    apiKey: embeddingsApiKey,
    baseURL: `${endpoint}openai/deployments/${embeddingsDeploymentName}`,
    defaultQuery: { "api-version": embeddingsApiVersion },
    defaultHeaders: { "api-key": embeddingsApiKey },
  });
}

/**
 * Gets the model configuration (without secrets) for chat threads
 */
export async function getModelConfigForThread(modelId?: string): Promise<Pick<ModelConfig, 'id' | 'friendlyName' | 'deploymentName'>> {
  let modelResponse;
  
  if (modelId) {
    modelResponse = await getModelById(modelId);
  } else {
    modelResponse = await getDefaultModel();
  }

  if (modelResponse.status !== "OK") {
    throw new Error(`Failed to get model configuration: ${modelResponse.errors?.[0]?.message || 'Unknown error'}`);
  }

  const model = modelResponse.response;
  return {
    id: model.id,
    friendlyName: model.friendlyName,
    deploymentName: model.deploymentName
  };
}

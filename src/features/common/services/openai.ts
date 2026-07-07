import { OpenAI } from "openai";
import { AzureOpenAI } from "openai";

export const OpenAIInstance = () => {
  const openai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME}`,
    defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION },
    defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
  });
  return openai;
};

export const OpenAIEmbeddingInstance = () => {
  if (
    !process.env.AZURE_OPENAI_API_KEY ||
    !process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME ||
    !process.env.AZURE_OPENAI_API_INSTANCE_NAME
  ) {
    throw new Error(
      "Azure OpenAI Embeddings endpoint config is not set, check environment variables."
    );
  }

  const openai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: `https://${process.env.AZURE_OPENAI_API_INSTANCE_NAME}.openai.azure.com/openai/deployments/${process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME}`,
    defaultQuery: { "api-version": process.env.AZURE_OPENAI_API_VERSION },
    defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
  });
  return openai;
};

/**
 * Creates an AzureOpenAI client configured for GPT-Image-1.x
 * Uses dedicated environment variables for image generation
 * 
 * Required env vars:
 * - AZURE_OPENAI_GPT_IMAGE_API_INSTANCE_NAME
 * - AZURE_OPENAI_GPT_IMAGE_API_DEPLOYMENT_NAME
 * - AZURE_OPENAI_GPT_IMAGE_API_VERSION
 * - AZURE_OPENAI_GPT_IMAGE_API_KEY
 */
export const OpenAIImageInstance = (): AzureOpenAI => {
  const instanceName = process.env.AZURE_OPENAI_GPT_IMAGE_API_INSTANCE_NAME;
  const deploymentName = process.env.AZURE_OPENAI_GPT_IMAGE_API_DEPLOYMENT_NAME;
  const apiVersion = process.env.AZURE_OPENAI_GPT_IMAGE_API_VERSION;
  const apiKey = process.env.AZURE_OPENAI_GPT_IMAGE_API_KEY;

  if (!instanceName || !deploymentName || !apiVersion || !apiKey) {
    throw new Error(
      "Missing required environment variables for image generation: " +
      "AZURE_OPENAI_GPT_IMAGE_API_INSTANCE_NAME, AZURE_OPENAI_GPT_IMAGE_API_DEPLOYMENT_NAME, " +
      "AZURE_OPENAI_GPT_IMAGE_API_VERSION, AZURE_OPENAI_GPT_IMAGE_API_KEY"
    );
  }

  const endpoint = `https://${instanceName}.openai.azure.com`;

  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
    deployment: deploymentName,
  });
};